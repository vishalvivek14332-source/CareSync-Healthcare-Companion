import { Router, Response } from 'express';
import { queryRow, queryRows, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const hydrationRouter = Router();

// GET /api/hydration - Get current hydration state & logs for patient
hydrationRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    // 1. Fetch patient's hydration settings
    const settings = await queryRow<any>(`
      SELECT daily_goal_liters as "dailyGoalLiters", reminder_enabled as "reminderEnabled",
             start_time as "startTime", end_time as "endTime", interval_minutes as "intervalMinutes"
      FROM hydration_settings
      WHERE patient_id = ?
    `, [patientId]) || {
      dailyGoalLiters: 2.0,
      reminderEnabled: 1,
      startTime: '08:00',
      endTime: '20:00',
      intervalMinutes: 60,
    };

    // 2. Fetch today's real logs (since start of current day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logs = await queryRows<any>(`
      SELECT id, amount_ml as "amountMl", timestamp, logged_at as "loggedAt"
      FROM hydration_logs
      WHERE patient_id = ? AND logged_at >= ?
      ORDER BY logged_at DESC
    `, [patientId, todayStart.toISOString()]);

    const totalMl = logs.reduce((sum, log) => sum + (parseInt(log.amountMl, 10) || 0), 0);
    const currentLiters = Number((totalMl / 1000).toFixed(2));

    // 3. Compute real hourly intervals based on actual logs
    const hours = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'];
    const hourlyTrends = hours.map((hour) => {
      const hourNum = parseInt(hour, 10);
      const isPM = hour.includes('PM') && hourNum !== 12;
      const target24 = (isPM ? hourNum + 12 : (hour.includes('AM') && hourNum === 12 ? 0 : hourNum));
      
      const loggedUpTo = logs
        .filter((l) => {
          const d = new Date(l.loggedAt);
          return d.getHours() <= target24;
        })
        .reduce((sum, l) => sum + (parseInt(l.amountMl, 10) || 0), 0);

      return {
        hour,
        liters: Number((loggedUpTo / 1000).toFixed(2)),
      };
    });

    return res.json({
      currentLiters,
      goalLiters: parseFloat(settings.dailyGoalLiters) || 2.0,
      settings: {
        dailyGoalLiters: parseFloat(settings.dailyGoalLiters) || 2.0,
        reminderEnabled: Boolean(settings.reminderEnabled),
        startTime: settings.startTime,
        endTime: settings.endTime,
        intervalMinutes: parseInt(settings.intervalMinutes, 10) || 60,
      },
      nextReminderTime: settings.reminderEnabled ? `Every ${settings.intervalMinutes} mins (${settings.startTime} - ${settings.endTime})` : 'Reminders Disabled',
      logs,
      hourlyTrends,
    });
  } catch (err: any) {
    console.error('Hydration get error:', err);
    return res.status(500).json({ error: 'Failed to fetch hydration state' });
  }
});

// GET /api/hydration/settings
hydrationRouter.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const settings = await queryRow<any>(`
      SELECT daily_goal_liters as "dailyGoalLiters", reminder_enabled as "reminderEnabled",
             start_time as "startTime", end_time as "endTime", interval_minutes as "intervalMinutes"
      FROM hydration_settings
      WHERE patient_id = ?
    `, [patientId]);

    if (!settings) {
      return res.json({
        dailyGoalLiters: 2.0,
        reminderEnabled: true,
        startTime: '08:00',
        endTime: '20:00',
        intervalMinutes: 60,
      });
    }

    return res.json({
      dailyGoalLiters: parseFloat(settings.dailyGoalLiters) || 2.0,
      reminderEnabled: Boolean(settings.reminderEnabled),
      startTime: settings.startTime,
      endTime: settings.endTime,
      intervalMinutes: parseInt(settings.intervalMinutes, 10) || 60,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch hydration settings' });
  }
});

// PUT /api/hydration/settings - Update hydration schedule & goals
hydrationRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { dailyGoalLiters, reminderEnabled, startTime, endTime, intervalMinutes } = req.body;

    if (dailyGoalLiters !== undefined && (typeof dailyGoalLiters !== 'number' || dailyGoalLiters <= 0 || dailyGoalLiters > 10)) {
      return res.status(400).json({ error: 'Daily goal must be between 0.5 and 10.0 liters' });
    }

    if (intervalMinutes !== undefined && (typeof intervalMinutes !== 'number' || intervalMinutes < 15 || intervalMinutes > 360)) {
      return res.status(400).json({ error: 'Interval must be between 15 and 360 minutes' });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (startTime && !timeRegex.test(startTime)) {
      return res.status(400).json({ error: 'Invalid start time format. Use HH:mm (24-hour format)' });
    }
    if (endTime && !timeRegex.test(endTime)) {
      return res.status(400).json({ error: 'Invalid end time format. Use HH:mm (24-hour format)' });
    }

    const now = new Date().toISOString();
    const id = `hyd-set-${Date.now()}`;

    const existing = await queryRow<any>('SELECT id FROM hydration_settings WHERE patient_id = ?', [patientId]);

    if (existing) {
      await executeSql(`
        UPDATE hydration_settings
        SET daily_goal_liters = COALESCE(?, daily_goal_liters),
            reminder_enabled = COALESCE(?, reminder_enabled),
            start_time = COALESCE(?, start_time),
            end_time = COALESCE(?, end_time),
            interval_minutes = COALESCE(?, interval_minutes),
            updated_at = ?
        WHERE patient_id = ?
      `, [
        dailyGoalLiters ?? null,
        reminderEnabled !== undefined ? (reminderEnabled ? 1 : 0) : null,
        startTime ?? null,
        endTime ?? null,
        intervalMinutes ?? null,
        now,
        patientId,
      ]);
    } else {
      await executeSql(`
        INSERT INTO hydration_settings (id, patient_id, daily_goal_liters, reminder_enabled, start_time, end_time, interval_minutes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        patientId,
        dailyGoalLiters || 2.0,
        reminderEnabled !== undefined ? (reminderEnabled ? 1 : 0) : 1,
        startTime || '08:00',
        endTime || '20:00',
        intervalMinutes || 60,
        now,
      ]);
    }

    const updated = await queryRow<any>(`
      SELECT daily_goal_liters as "dailyGoalLiters", reminder_enabled as "reminderEnabled",
             start_time as "startTime", end_time as "endTime", interval_minutes as "intervalMinutes"
      FROM hydration_settings
      WHERE patient_id = ?
    `, [patientId]);

    return res.json({
      success: true,
      settings: {
        dailyGoalLiters: parseFloat(updated.dailyGoalLiters) || 2.0,
        reminderEnabled: Boolean(updated.reminderEnabled),
        startTime: updated.startTime,
        endTime: updated.endTime,
        intervalMinutes: parseInt(updated.intervalMinutes, 10) || 60,
      },
    });
  } catch (err: any) {
    console.error('Update hydration settings error:', err);
    return res.status(500).json({ error: 'Failed to update hydration settings' });
  }
});

// POST /api/hydration/log - Log water intake
hydrationRouter.post('/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { amountMl } = req.body;

    if (!amountMl || typeof amountMl !== 'number' || amountMl <= 0 || amountMl > 3000) {
      return res.status(400).json({ error: 'Valid amountMl between 1 and 3000 is required' });
    }

    const id = `h-${Date.now()}`;
    const now = new Date().toISOString();
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await executeSql(`
      INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, patientId, amountMl, timestampStr, now]);

    return res.status(201).json({ id, amountMl, timestamp: timestampStr });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to log water intake' });
  }
});
