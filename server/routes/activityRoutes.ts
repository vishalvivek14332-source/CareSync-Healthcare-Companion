import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';

export const activityRouter = Router();

activityRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || req.user?.userId || 'p-1';
    const todayStr = new Date().toISOString().split('T')[0];

    let activity = db.prepare(`
      SELECT steps, step_goal as stepGoal, active_minutes as activeMinutes,
             active_minutes_goal as activeMinutesGoal, calories_burned as caloriesBurned,
             distance_km as distanceKm
      FROM activity_logs
      WHERE patient_id = ? AND log_date = ?
    `).get(patientId, todayStr) as any;

    if (!activity) {
      activity = {
        steps: 4821,
        stepGoal: 5000,
        activeMinutes: 32,
        activeMinutesGoal: 30,
        caloriesBurned: 185,
        distanceKm: 3.2,
      };
    }

    const weeklySteps = [
      { day: 'Mon', steps: 5120, goal: 5000 },
      { day: 'Tue', steps: 4900, goal: 5000 },
      { day: 'Wed', steps: 5400, goal: 5000 },
      { day: 'Thu', steps: activity.steps, goal: 5000 },
      { day: 'Fri', steps: 3900, goal: 5000 },
      { day: 'Sat', steps: 4200, goal: 5000 },
      { day: 'Sun', steps: 4600, goal: 5000 },
    ];

    return res.json({
      ...activity,
      isTrackingActive: false,
      weeklySteps,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch activity state' });
  }
});

activityRouter.post('/session', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.userId || 'p-1';
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
