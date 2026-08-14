import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const activityRouter = Router();

// GET /api/activity - Fetch actual activity stats for patient
activityRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch today's real activity record
    let activity = db.prepare(`
      SELECT steps, step_goal as stepGoal, active_minutes as activeMinutes,
             active_minutes_goal as activeMinutesGoal, calories_burned as caloriesBurned,
             distance_km as distanceKm
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `).get(patientId, todayStr) as any;

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
    }

    // Fetch last 7 days of actual logs for weekly stability
    const pastLogs = db.prepare(`
      SELECT log_date as logDate, steps, step_goal as stepGoal
      FROM activity_logs
      WHERE patient_id = ?
      ORDER BY log_date DESC
      LIMIT 7
    `).all(patientId) as any[];

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
        steps: record ? record.steps : (dateStr === todayStr ? activity.steps : 0),
        goal: record ? record.stepGoal : 5000,
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
activityRouter.post('/sync', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { steps = 0, distanceKm = 0, caloriesBurned = 0, activeMinutes = 0 } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    if (typeof steps !== 'number' || steps < 0) {
      return res.status(400).json({ error: 'Valid step count is required' });
    }

    const existing = db.prepare('SELECT id, steps FROM activity_logs WHERE patient_id = ? AND log_date = ?').get(patientId, todayStr) as any;

    if (existing) {
      // Overwrite/update with latest device step sensor count
      db.prepare(`
        UPDATE activity_logs
        SET steps = MAX(steps, ?),
            active_minutes = MAX(active_minutes, ?),
            distance_km = MAX(distance_km, ?),
            calories_burned = MAX(calories_burned, ?)
        WHERE id = ?
      `).run(steps, activeMinutes, distanceKm, caloriesBurned, existing.id);
    } else {
      db.prepare(`
        INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
        VALUES (?, ?, ?, 5000, ?, 30, ?, ?, ?)
      `).run(`act-${Date.now()}`, patientId, steps, activeMinutes, caloriesBurned, distanceKm, todayStr);
    }

    const updated = db.prepare(`
      SELECT steps, step_goal as stepGoal, active_minutes as activeMinutes,
             active_minutes_goal as activeMinutesGoal, calories_burned as caloriesBurned,
             distance_km as distanceKm
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `).get(patientId, todayStr);

    return res.json({ success: true, activity: updated });
  } catch (err: any) {
    console.error('Activity sync error:', err);
    return res.status(500).json({ error: 'Failed to sync device activity' });
  }
});

// POST /api/activity/session - Record manual walk/jog session
activityRouter.post('/session', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { addedSteps = 650, addedMinutes = 12, addedKm = 0.5, addedCalories = 45 } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    const existing = db.prepare('SELECT id FROM activity_logs WHERE patient_id = ? AND log_date = ?').get(patientId, todayStr) as any;

    if (existing) {
      db.prepare(`
        UPDATE activity_logs
        SET steps = steps + ?,
            active_minutes = active_minutes + ?,
            distance_km = distance_km + ?,
            calories_burned = calories_burned + ?
        WHERE id = ?
      `).run(addedSteps, addedMinutes, addedKm, addedCalories, existing.id);
    } else {
      db.prepare(`
        INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
        VALUES (?, ?, ?, 5000, ?, 30, ?, ?, ?)
      `).run(`act-${Date.now()}`, patientId, addedSteps, addedMinutes, addedCalories, addedKm, todayStr);
    }

    const updated = db.prepare(`
      SELECT steps, step_goal as stepGoal, active_minutes as activeMinutes,
             active_minutes_goal as activeMinutesGoal, calories_burned as caloriesBurned,
             distance_km as distanceKm
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `).get(patientId, todayStr);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record activity session' });
  }
});
