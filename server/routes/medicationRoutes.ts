import { Router, Response } from 'express';
import { db } from '../db';
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

// GET all medications for patient with today's status
medicationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const meds = db.prepare(`
      SELECT m.id, m.name, m.dosage, m.scheduled_time as scheduledTime,
             m.instructions, m.category, m.color,
             COALESCE(ml.status, 'due') as status,
             ml.taken_at as takenAt
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
    `).all(todayStr, patientId);

    return res.json(meds);
  } catch (err: any) {
    console.error('Error fetching medications:', err);
    return res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// POST new medication schedule (CRUD - Create)
medicationRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { name, dosage, scheduledTime, instructions, category = 'afternoon', color } = req.body;

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

    db.prepare(`
      INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, patientId, name.trim(), dosage.trim(), normalizedTime, (instructions || 'Take as prescribed').trim(), category, defaultColor, now);

    // Initial log entry for today
    db.prepare(`
      INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, created_at)
      VALUES (?, ?, ?, 'due', ?, ?)
    `).run(`mlog-${Date.now()}`, id, patientId, todayStr, now);

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
    };

    return res.status(201).json(newMed);
  } catch (err: any) {
    console.error('Error adding medication:', err);
    return res.status(500).json({ error: 'Failed to add medication' });
  }
});

// PUT update medication (CRUD - Update)
medicationRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = db.prepare('SELECT patient_id FROM medications WHERE id = ?').get(id) as any;
    if (!med) return res.status(404).json({ error: 'Medication not found' });

    const patientId = getAuthorizedPatientId(req, res, med.patient_id);
    if (!patientId) return;

    const { name, dosage, scheduledTime, instructions, category } = req.body;

    let normalizedTime: string | null = null;
    if (scheduledTime) {
      normalizedTime = normalizeScheduledTime(scheduledTime);
      if (!normalizedTime) {
        return res.status(400).json({ error: 'Invalid scheduled time format. Use HH:mm or hh:mm AM/PM' });
      }
    }

    db.prepare(`
      UPDATE medications
      SET name = COALESCE(?, name),
          dosage = COALESCE(?, dosage),
          scheduled_time = COALESCE(?, scheduled_time),
          instructions = COALESCE(?, instructions),
          category = COALESCE(?, category)
      WHERE id = ?
    `).run(name ? name.trim() : null, dosage ? dosage.trim() : null, normalizedTime, instructions ? instructions.trim() : null, category ?? null, id);

    const updatedMed = db.prepare(`
      SELECT m.id, m.name, m.dosage, m.scheduled_time as scheduledTime,
             m.instructions, m.category, m.color, m.active
      FROM medications m WHERE m.id = ?
    `).get(id);

    return res.json({ message: 'Medication updated successfully', medication: updatedMed });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update medication' });
  }
});

// DELETE medication (CRUD - Delete / Deactivate)
medicationRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = db.prepare('SELECT patient_id FROM medications WHERE id = ?').get(id) as any;
    if (!med) return res.status(404).json({ error: 'Medication not found' });

    const patientId = getAuthorizedPatientId(req, res, med.patient_id);
    if (!patientId) return;

    db.prepare('UPDATE medications SET active = 0 WHERE id = ?').run(id);

    // Cancel any active escalation states for this medication
    db.prepare("UPDATE medication_escalation_states SET status = 'resolved' WHERE medication_id = ? AND status = 'active'").run(id);

    return res.json({ message: 'Medication removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete medication' });
  }
});

// POST log dose (take / snooze)
medicationRouter.post('/:id/log', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const med = db.prepare('SELECT patient_id FROM medications WHERE id = ?').get(id) as any;
    const patientId = getAuthorizedPatientId(req, res, med?.patient_id);
    if (!patientId) return;

    const { status = 'taken', takenAt } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];
    const nowStr = takenAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const existingLog = db.prepare('SELECT id FROM medication_logs WHERE medication_id = ? AND scheduled_date = ?').get(id, todayStr) as any;

    if (existingLog) {
      db.prepare(`
        UPDATE medication_logs
        SET status = ?, taken_at = ?
        WHERE id = ?
      `).run(status, status === 'taken' ? nowStr : null, existingLog.id);
    } else {
      db.prepare(`
        INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`mlog-${Date.now()}`, id, patientId, status, todayStr, status === 'taken' ? nowStr : null, new Date().toISOString());
    }

    // Immediately resolve active escalation state if taken
    if (status === 'taken') {
      db.prepare(`
        UPDATE medication_escalation_states
        SET status = 'resolved', updated_at = ?
        WHERE patient_id = ? AND medication_id = ? AND scheduled_date = ?
      `).run(new Date().toISOString(), patientId, id, todayStr);
    }

    return res.json({ success: true, medicationId: id, status, takenAt: status === 'taken' ? nowStr : undefined });
  } catch (err: any) {
    console.error('Error logging medication dose:', err);
    return res.status(500).json({ error: 'Failed to log dose' });
  }
});
