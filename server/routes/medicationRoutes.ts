import { Router, Response } from 'express';
import { queryRow, queryRows, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const medicationRouter = Router();

// Helper to validate and normalize medication time (supports 12h AM/PM and 24h)
export function normalizeScheduledTime(timeStr: string): string | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();

  // 12-hour format with AM/PM: e.g. "8:00 AM", "08:00 PM"
  const match12 = trimmed.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (match12) {
    const hours = match12[1].padStart(2, '0');
    const minutes = match12[2];
    const ampm = match12[3].toUpperCase();
    return `${hours}:${minutes} ${ampm}`;
  }

  // 24-hour format: e.g. "08:00", "14:30"
  const match24 = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (match24) {
    let hoursNum = parseInt(match24[1], 10);
    const minutes = match24[2];
    const ampm = hoursNum >= 12 ? 'PM' : 'AM';
    if (hoursNum === 0) hoursNum = 12;
    else if (hoursNum > 12) hoursNum -= 12;
    return `${String(hoursNum).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  return null;
}

// Helper to check if a medication is active on a specific YYYY-MM-DD date
export function isMedicationActiveOnDate(
  med: {
    startDate?: string | null;
    endDate?: string | null;
    repeatPattern?: string | null;
    daysOfWeek?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    repeat_pattern?: string | null;
    days_of_week?: string | null;
  },
  targetDateStr: string
): boolean {
  const startDate = med.startDate || med.start_date;
  const endDate = med.endDate || med.end_date;
  const repeatPattern = med.repeatPattern || med.repeat_pattern;
  const daysOfWeek = med.daysOfWeek || med.days_of_week;

  if (startDate && targetDateStr < startDate) return false;
  if (endDate && targetDateStr > endDate) return false;

  const pattern = (repeatPattern || 'daily').toLowerCase();
  if (pattern === 'daily') return true;

  const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
  const dayIndex = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayShort = dayNames[dayIndex];
  const currentDayFull = fullDayNames[dayIndex];

  if (pattern === 'weekdays') {
    return dayIndex >= 1 && dayIndex <= 5;
  }
  if (pattern === 'weekends') {
    return dayIndex === 0 || dayIndex === 6;
  }
  if (pattern === 'custom' && daysOfWeek) {
    let days: string[] = [];
    try {
      if (daysOfWeek.startsWith('[')) {
        days = JSON.parse(daysOfWeek).map((d: string) => d.toLowerCase());
      } else {
        days = daysOfWeek.split(',').map((d: string) => d.trim().toLowerCase());
      }
    } catch {
      days = daysOfWeek.split(',').map((d: string) => d.trim().toLowerCase());
    }
    return days.some((d) => d === currentDayShort || d === currentDayFull || d === 'all');
  }

  return true;
}

// GET all medications for patient with date-specific status
medicationRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const requestedDate = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const allMeds = await queryRows<any>(`
      SELECT m.id, m.name, m.dosage, m.scheduled_time as "scheduledTime",
             m.instructions, m.category, m.color, m.active,
             m.start_date as "startDate", m.end_date as "endDate",
             m.repeat_pattern as "repeatPattern", m.days_of_week as "daysOfWeek",
             COALESCE(ml.status, 'due') as status,
             ml.taken_at as "takenAt"
      FROM medications m
      LEFT JOIN medication_logs ml ON m.id = ml.medication_id AND ml.scheduled_date = ?
      WHERE m.patient_id = ? AND m.active = 1
      ORDER BY 
        CASE m.category 
          WHEN 'morning' THEN 1 
          WHEN 'afternoon' THEN 2 
          WHEN 'evening' THEN 3 
          ELSE 4 
        END
    `, [requestedDate, patientId]);

    // Filter medications that are active on the requested date
    const activeOnDate = allMeds.filter((m) => isMedicationActiveOnDate(m, requestedDate)).map((m) => {
      let daysOfWeekParsed: string[] | undefined = undefined;
      if (m.daysOfWeek) {
        try {
          daysOfWeekParsed = m.daysOfWeek.startsWith('[') ? JSON.parse(m.daysOfWeek) : m.daysOfWeek.split(',').map((s: string) => s.trim());
        } catch {
          daysOfWeekParsed = m.daysOfWeek.split(',').map((s: string) => s.trim());
        }
      }
      return {
        ...m,
        daysOfWeek: daysOfWeekParsed,
      };
    });

    return res.json(activeOnDate);
  } catch (err: any) {
    console.error('Error fetching medications:', err);
    return res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// POST new medication schedule (CRUD - Create)
medicationRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const {
      name,
      dosage,
      scheduledTime,
      instructions,
      category = 'afternoon',
      color,
      startDate,
      endDate,
      repeatPattern = 'daily',
      daysOfWeek,
    } = req.body;

    if (!name || !dosage || !scheduledTime) {
      return res.status(400).json({ error: 'Name, dosage, and scheduled time are required' });
    }

    const normalizedTime = normalizeScheduledTime(scheduledTime);
    if (!normalizedTime) {
      return res.status(400).json({ error: 'Invalid scheduled time format. Use HH:mm or hh:mm AM/PM' });
    }

    const id = `med-${Date.now()}`;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    const defaultColor = color || (
      category === 'morning'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : category === 'afternoon'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
    );

    const daysOfWeekStr = Array.isArray(daysOfWeek) ? JSON.stringify(daysOfWeek) : (daysOfWeek || 'all');

    await executeSql(`
      INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, start_date, end_date, repeat_pattern, days_of_week, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `, [
      id,
      patientId,
      name.trim(),
      dosage.trim(),
      normalizedTime,
      (instructions || 'Take as prescribed').trim(),
      category,
      defaultColor,
      startDate || null,
      endDate || null,
      repeatPattern || 'daily',
      daysOfWeekStr,
      now,
    ]);

    // Initial log entry for today
    await executeSql(`
      INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, created_at)
      VALUES (?, ?, ?, 'due', ?, ?)
    `, [`mlog-${Date.now()}`, id, patientId, todayStr, now]);

    const newMed = {
      id,
      patientId,
      name: name.trim(),
      dosage: dosage.trim(),
      scheduledTime: normalizedTime,
      instructions: (instructions || 'Take as prescribed').trim(),
      status: 'due',
      category,
      color: defaultColor,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      repeatPattern: repeatPattern || 'daily',
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : undefined,
    };

    return res.status(201).json(newMed);
  } catch (err: any) {
    console.error('Error adding medication:', err);
    return res.status(500).json({ error: 'Failed to add medication' });
  }
});

// PUT update medication (CRUD - Update)
medicationRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = await queryRow<any>('SELECT patient_id FROM medications WHERE id = ?', [id]);
    if (!med) return res.status(404).json({ error: 'Medication not found' });

    const patientId = await getAuthorizedPatientId(req, res, med.patient_id);
    if (!patientId) return;

    const {
      name,
      dosage,
      scheduledTime,
      instructions,
      category,
      startDate,
      endDate,
      repeatPattern,
      daysOfWeek,
    } = req.body;

    let normalizedTime: string | null = null;
    if (scheduledTime) {
      normalizedTime = normalizeScheduledTime(scheduledTime);
      if (!normalizedTime) {
        return res.status(400).json({ error: 'Invalid scheduled time format. Use HH:mm or hh:mm AM/PM' });
      }
    }

    const daysOfWeekStr = daysOfWeek !== undefined ? (Array.isArray(daysOfWeek) ? JSON.stringify(daysOfWeek) : String(daysOfWeek)) : null;

    await executeSql(`
      UPDATE medications
      SET name = COALESCE(?, name),
          dosage = COALESCE(?, dosage),
          scheduled_time = COALESCE(?, scheduled_time),
          instructions = COALESCE(?, instructions),
          category = COALESCE(?, category),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          repeat_pattern = COALESCE(?, repeat_pattern),
          days_of_week = COALESCE(?, days_of_week),
          updated_at = ?
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      dosage ? dosage.trim() : null,
      normalizedTime,
      instructions ? instructions.trim() : null,
      category ?? null,
      startDate !== undefined ? startDate : null,
      endDate !== undefined ? endDate : null,
      repeatPattern !== undefined ? repeatPattern : null,
      daysOfWeekStr,
      new Date().toISOString(),
      id,
    ]);

    const rawMed = await queryRow<any>(`
      SELECT m.id, m.name, m.dosage, m.scheduled_time,
             m.instructions, m.category, m.color, m.active,
             m.start_date, m.end_date,
             m.repeat_pattern, m.days_of_week
      FROM medications m WHERE m.id = ?
    `, [id]);

    const updatedMed = rawMed ? {
      id: rawMed.id,
      name: rawMed.name,
      dosage: rawMed.dosage,
      scheduledTime: rawMed.scheduled_time || rawMed.scheduledTime,
      instructions: rawMed.instructions,
      category: rawMed.category,
      color: rawMed.color,
      active: rawMed.active,
      startDate: rawMed.start_date || rawMed.startDate,
      endDate: rawMed.end_date || rawMed.endDate,
      repeatPattern: rawMed.repeat_pattern || rawMed.repeatPattern,
      daysOfWeek: rawMed.days_of_week || rawMed.daysOfWeek,
    } : null;

    return res.json({
      message: 'Medication updated successfully',
      medication: updatedMed,
      ...(updatedMed || {}),
    });
  } catch (err: any) {
    console.error('PUT /:id error:', err);
    return res.status(500).json({ error: 'Failed to update medication', details: err?.message });
  }
});

// DELETE medication (CRUD - Delete / Deactivate)
medicationRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = await queryRow<any>('SELECT patient_id FROM medications WHERE id = ?', [id]);
    if (!med) return res.status(404).json({ error: 'Medication not found' });

    const patientId = await getAuthorizedPatientId(req, res, med.patient_id);
    if (!patientId) return;

    await executeSql('UPDATE medications SET active = 0 WHERE id = ?', [id]);

    // Cancel any active escalation states for this medication
    await executeSql("UPDATE medication_escalation_states SET status = 'resolved' WHERE medication_id = ? AND status = 'active'", [id]);

    return res.json({ message: 'Medication removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete medication' });
  }
});

// POST log dose (take / snooze)
medicationRouter.post('/:id/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = await queryRow<any>('SELECT patient_id FROM medications WHERE id = ?', [id]);
    const patientId = await getAuthorizedPatientId(req, res, med?.patient_id);
    if (!patientId) return;

    const { status = 'taken', takenAt, scheduledDate } = req.body;
    const targetDateStr = scheduledDate || new Date().toISOString().split('T')[0];
    const nowStr = takenAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const existingLog = await queryRow<any>('SELECT id FROM medication_logs WHERE medication_id = ? AND scheduled_date = ?', [id, targetDateStr]);

    if (existingLog) {
      await executeSql(`
        UPDATE medication_logs
        SET status = ?, taken_at = ?
        WHERE id = ?
      `, [status, status === 'taken' ? nowStr : null, existingLog.id]);
    } else {
      await executeSql(`
        INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [`mlog-${Date.now()}`, id, patientId, status, targetDateStr, status === 'taken' ? nowStr : null, new Date().toISOString()]);
    }

    // Immediately resolve active escalation state if taken
    if (status === 'taken') {
      await executeSql(`
        UPDATE medication_escalation_states
        SET status = 'resolved', updated_at = ?
        WHERE patient_id = ? AND medication_id = ? AND scheduled_date = ?
      `, [new Date().toISOString(), patientId, id, targetDateStr]);
    }

    return res.json({ success: true, medicationId: id, status, takenAt: status === 'taken' ? nowStr : undefined });
  } catch (err: any) {
    console.error('Error logging medication dose:', err);
    return res.status(500).json({ error: 'Failed to log dose' });
  }
});

