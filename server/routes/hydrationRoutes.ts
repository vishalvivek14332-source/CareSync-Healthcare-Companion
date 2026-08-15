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

// -----------------------------------------------------------------------------
// HYDRATION SCHEDULES CRUD (Multi-Slot Discrete Reminders)
// -----------------------------------------------------------------------------

// GET /api/hydration/schedules - Fetch all hydration schedules
hydrationRouter.get('/schedules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const schedules = await queryRows<any>(`
      SELECT id, patient_id as "patientId", scheduled_time as "scheduledTime",
             amount_ml as "amountMl", repeat_days as "repeatDays",
             enabled, start_date as "startDate", end_date as "endDate",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM hydration_schedules
      WHERE patient_id = ?
      ORDER BY scheduled_time ASC
    `, [patientId]);

    const formatted = schedules.map((s) => ({
      id: s.id,
      patientId: s.patientId,
      scheduledTime: s.scheduledTime,
      amountMl: parseInt(s.amountMl, 10) || 250,
      repeatDays: s.repeatDays || 'daily',
      enabled: Boolean(s.enabled),
      startDate: s.startDate || undefined,
      endDate: s.endDate || undefined,
    }));

    return res.json(formatted);
  } catch (err: any) {
    console.error('Fetch hydration schedules error:', err);
    return res.status(500).json({ error: 'Failed to fetch hydration schedules' });
  }
});

// POST /api/hydration/schedules - Create a new hydration schedule slot
hydrationRouter.post('/schedules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { scheduledTime, amountMl = 250, repeatDays = 'daily', enabled = true, startDate, endDate } = req.body;

    if (!scheduledTime || typeof scheduledTime !== 'string') {
      return res.status(400).json({ error: 'Valid scheduledTime string is required (e.g. "08:00" or "08:00 AM")' });
    }

    if (amountMl && (typeof amountMl !== 'number' || amountMl <= 0 || amountMl > 3000)) {
      return res.status(400).json({ error: 'Amount must be between 1 and 3000 ml' });
    }

    const id = `hyd-sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await executeSql(`
      INSERT INTO hydration_schedules (id, patient_id, scheduled_time, amount_ml, repeat_days, enabled, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      patientId,
      scheduledTime.trim(),
      amountMl,
      repeatDays,
      enabled ? 1 : 0,
      startDate || null,
      endDate || null,
      now,
      now,
    ]);

    const created = await queryRow<any>(`
      SELECT id, patient_id as "patientId", scheduled_time as "scheduledTime",
             amount_ml as "amountMl", repeat_days as "repeatDays",
             enabled, start_date as "startDate", end_date as "endDate"
      FROM hydration_schedules
      WHERE id = ?
    `, [id]);

    return res.status(201).json({
      id: created.id,
      patientId: created.patientId,
      scheduledTime: created.scheduledTime,
      amountMl: parseInt(created.amountMl, 10),
      repeatDays: created.repeatDays,
      enabled: Boolean(created.enabled),
      startDate: created.startDate || undefined,
      endDate: created.endDate || undefined,
    });
  } catch (err: any) {
    console.error('Create hydration schedule error:', err);
    return res.status(500).json({ error: 'Failed to create hydration schedule' });
  }
});

// PUT /api/hydration/schedules/:id - Update hydration schedule slot
hydrationRouter.put('/schedules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scheduleId = req.params.id;
    const existing = await queryRow<any>('SELECT * FROM hydration_schedules WHERE id = ?', [scheduleId]);
    if (!existing) {
      return res.status(404).json({ error: 'Hydration schedule not found' });
    }

    const patientId = await getAuthorizedPatientId(req, res, existing.patient_id);
    if (!patientId) return;

    const { scheduledTime, amountMl, repeatDays, enabled, startDate, endDate } = req.body;
    const now = new Date().toISOString();

    await executeSql(`
      UPDATE hydration_schedules
      SET scheduled_time = COALESCE(?, scheduled_time),
          amount_ml = COALESCE(?, amount_ml),
          repeat_days = COALESCE(?, repeat_days),
          enabled = COALESCE(?, enabled),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          updated_at = ?
      WHERE id = ?
    `, [
      scheduledTime ? scheduledTime.trim() : null,
      amountMl !== undefined ? Number(amountMl) : null,
      repeatDays !== undefined ? repeatDays : null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      startDate !== undefined ? startDate : null,
      endDate !== undefined ? endDate : null,
      now,
      scheduleId,
    ]);

    const updated = await queryRow<any>(`
      SELECT id, patient_id as "patientId", scheduled_time as "scheduledTime",
             amount_ml as "amountMl", repeat_days as "repeatDays",
             enabled, start_date as "startDate", end_date as "endDate"
      FROM hydration_schedules
      WHERE id = ?
    `, [scheduleId]);

    return res.json({
      id: updated.id,
      patientId: updated.patientId,
      scheduledTime: updated.scheduledTime,
      amountMl: parseInt(updated.amountMl, 10),
      repeatDays: updated.repeatDays,
      enabled: Boolean(updated.enabled),
      startDate: updated.startDate || undefined,
      endDate: updated.endDate || undefined,
    });
  } catch (err: any) {
    console.error('Update hydration schedule error:', err);
    return res.status(500).json({ error: 'Failed to update hydration schedule' });
  }
});

// DELETE /api/hydration/schedules/:id - Delete hydration schedule slot
hydrationRouter.delete('/schedules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scheduleId = req.params.id;
    const existing = await queryRow<any>('SELECT * FROM hydration_schedules WHERE id = ?', [scheduleId]);
    if (!existing) {
      return res.status(404).json({ error: 'Hydration schedule not found' });
    }

    const patientId = await getAuthorizedPatientId(req, res, existing.patient_id);
    if (!patientId) return;

    await executeSql('DELETE FROM hydration_schedules WHERE id = ?', [scheduleId]);
    return res.json({ message: 'Hydration schedule deleted successfully' });
  } catch (err: any) {
    console.error('Delete hydration schedule error:', err);
    return res.status(500).json({ error: 'Failed to delete hydration schedule' });
  }
});

