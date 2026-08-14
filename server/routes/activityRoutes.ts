import { Router, Response } from 'express';
import { queryRow, queryRows, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const activityRouter = Router();

// GET /api/activity - Fetch actual activity stats for patient
activityRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch today's real activity record
    let activity = await queryRow<any>(`
      SELECT steps, step_goal as "stepGoal", active_minutes as "activeMinutes",
             active_minutes_goal as "activeMinutesGoal", calories_burned as "caloriesBurned",
             distance_km as "distanceKm"
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `, [patientId, todayStr]);

    const hasRecordedActivityToday = !!activity;

    if (!activity) {
      activity = {
        steps: 0,
        stepGoal: 5000,
        activeMinutes: 0,
        activeMinutesGoal: 30,
        caloriesBurned: 0,
        distanceKm: 0,
      };
    } else {
      activity = {
        steps: parseInt(activity.steps, 10) || 0,
        stepGoal: parseInt(activity.stepGoal, 10) || 5000,
        activeMinutes: parseInt(activity.activeMinutes, 10) || 0,
        activeMinutesGoal: parseInt(activity.activeMinutesGoal, 10) || 30,
        caloriesBurned: parseInt(activity.caloriesBurned, 10) || 0,
        distanceKm: parseFloat(activity.distanceKm) || 0,
      };
    }

    // Fetch last 7 days of actual logs for weekly stability
    const pastLogs = await queryRows<any>(`
      SELECT log_date as "logDate", steps, step_goal as "stepGoal"
      FROM activity_logs
      WHERE patient_id = ?
      ORDER BY log_date DESC
      LIMIT 7
    `, [patientId]);

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    // Generate 7-day trend from real records (0 if not recorded)
    const weeklySteps = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysOfWeek[d.getDay()];
      
      const record = pastLogs.find((p) => p.logDate === dateStr);
      weeklySteps.push({
        day: dayName,
        date: dateStr,
        steps: record ? (parseInt(record.steps, 10) || 0) : (dateStr === todayStr ? activity.steps : 0),
        goal: record ? (parseInt(record.stepGoal, 10) || 5000) : 5000,
      });
    }

    return res.json({
      ...activity,
      hasRecordedActivityToday,
      isTrackingActive: false,
      weeklySteps,
    });
  } catch (err: any) {
    console.error('Activity get error:', err);
    return res.status(500).json({ error: 'Failed to fetch activity state' });
  }
});

// POST /api/activity/sync - Sync real device steps from native pedometer sensor
activityRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { steps = 0, distanceKm = 0, caloriesBurned = 0, activeMinutes = 0 } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    if (typeof steps !== 'number' || steps < 0) {
      return res.status(400).json({ error: 'Valid step count is required' });
    }

    const existing = await queryRow<any>('SELECT id, steps, active_minutes, distance_km, calories_burned FROM activity_logs WHERE patient_id = ? AND log_date = ?', [patientId, todayStr]);

    if (existing) {
      const newSteps = Math.max(parseInt(existing.steps, 10) || 0, steps);
      const newMinutes = Math.max(parseInt(existing.active_minutes, 10) || 0, activeMinutes);
      const newDistance = Math.max(parseFloat(existing.distance_km) || 0, distanceKm);
      const newCalories = Math.max(parseInt(existing.calories_burned, 10) || 0, caloriesBurned);

      await executeSql(`
        UPDATE activity_logs
        SET steps = ?,
            active_minutes = ?,
            distance_km = ?,
            calories_burned = ?
        WHERE id = ?
      `, [newSteps, newMinutes, newDistance, newCalories, existing.id]);
    } else {
      await executeSql(`
        INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
        VALUES (?, ?, ?, 5000, ?, 30, ?, ?, ?)
      `, [`act-${Date.now()}`, patientId, steps, activeMinutes, caloriesBurned, distanceKm, todayStr]);
    }

    const updated = await queryRow<any>(`
      SELECT steps, step_goal as "stepGoal", active_minutes as "activeMinutes",
             active_minutes_goal as "activeMinutesGoal", calories_burned as "caloriesBurned",
             distance_km as "distanceKm"
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `, [patientId, todayStr]);

    return res.json({
      success: true,
      activity: {
        steps: parseInt(updated.steps, 10) || 0,
        stepGoal: parseInt(updated.stepGoal, 10) || 5000,
        activeMinutes: parseInt(updated.activeMinutes, 10) || 0,
        activeMinutesGoal: parseInt(updated.activeMinutesGoal, 10) || 30,
        caloriesBurned: parseInt(updated.caloriesBurned, 10) || 0,
        distanceKm: parseFloat(updated.distanceKm) || 0,
      },
    });
  } catch (err: any) {
    console.error('Activity sync error:', err);
    return res.status(500).json({ error: 'Failed to sync device activity' });
  }
});

// POST /api/activity/session - Record manual walk/jog session
activityRouter.post('/session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { addedSteps = 650, addedMinutes = 12, addedKm = 0.5, addedCalories = 45 } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    const existing = await queryRow<any>('SELECT id, steps, active_minutes, distance_km, calories_burned FROM activity_logs WHERE patient_id = ? AND log_date = ?', [patientId, todayStr]);

    if (existing) {
      await executeSql(`
        UPDATE activity_logs
        SET steps = steps + ?,
            active_minutes = active_minutes + ?,
            distance_km = distance_km + ?,
            calories_burned = calories_burned + ?
        WHERE id = ?
      `, [addedSteps, addedMinutes, addedKm, addedCalories, existing.id]);
    } else {
      await executeSql(`
        INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
        VALUES (?, ?, ?, 5000, ?, 30, ?, ?, ?)
      `, [`act-${Date.now()}`, patientId, addedSteps, addedMinutes, addedCalories, addedKm, todayStr]);
    }

    const updated = await queryRow<any>(`
      SELECT steps, step_goal as "stepGoal", active_minutes as "activeMinutes",
             active_minutes_goal as "activeMinutesGoal", calories_burned as "caloriesBurned",
             distance_km as "distanceKm"
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `, [patientId, todayStr]);

    return res.json({
      success: true,
      activity: {
        steps: parseInt(updated.steps, 10) || 0,
        stepGoal: parseInt(updated.stepGoal, 10) || 5000,
        activeMinutes: parseInt(updated.activeMinutes, 10) || 0,
        activeMinutesGoal: parseInt(updated.activeMinutesGoal, 10) || 30,
        caloriesBurned: parseInt(updated.caloriesBurned, 10) || 0,
        distanceKm: parseFloat(updated.distanceKm) || 0,
      },
    });
  } catch (err: any) {
    console.error('Record session error:', err);
    return res.status(500).json({ error: 'Failed to record activity session' });
  }
});
