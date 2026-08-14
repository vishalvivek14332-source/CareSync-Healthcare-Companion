import { Router, Response } from 'express';
import { queryRow, queryRows, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const alertRouter = Router();

alertRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role || 'patient';
    const userId = req.user?.userId || 'p-1';
    let alerts: any[];

    if (userRole === 'patient') {
      const patientId = await getAuthorizedPatientId(req, res);
      if (!patientId) return;
      alerts = await queryRows(`
        SELECT id, patient_id as "patientId", patient_name as "patientName",
               type, severity, title, description, reviewed,
               action_text as "actionText", timestamp
        FROM alerts
        WHERE patient_id = ?
        ORDER BY created_at DESC
      `, [patientId]);
    } else {
      // Caregiver: only return alerts for patients linked in caregiver_patient_links
      alerts = await queryRows(`
        SELECT id, patient_id as "patientId", patient_name as "patientName",
               type, severity, title, description, reviewed,
               action_text as "actionText", timestamp
        FROM alerts
        WHERE patient_id IN (
          SELECT patient_id FROM caregiver_patient_links WHERE caregiver_id = ?
        )
        ORDER BY created_at DESC
      `, [userId]);
    }

    return res.json(alerts.map((a) => ({ ...a, reviewed: Boolean(a.reviewed) })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

alertRouter.put('/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ error: 'Access denied: Caregiver role required to review alerts' });
    }

    const { id } = req.params;
    const alert = await queryRow<any>('SELECT patient_id FROM alerts WHERE id = ?', [id]);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const patientId = await getAuthorizedPatientId(req, res, alert.patient_id);
    if (!patientId) return;

    await executeSql('UPDATE alerts SET reviewed = 1 WHERE id = ?', [id]);
    return res.json({ success: true, id, reviewed: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark alert as reviewed' });
  }
});

alertRouter.post('/sos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res);
    if (!patientId) return;

    const { reason = 'Manual Emergency Trigger' } = req.body;
    const now = new Date().toISOString();

    const patient = await queryRow<any>('SELECT name FROM users WHERE id = ?', [patientId]);
    const patientName = patient?.name || 'Alex Johnson';

    const id = `alt-sos-${Date.now()}`;
    await executeSql(`
      INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
      VALUES (?, ?, ?, 'missed_medication', 'emergency', '🚨 Immediate Emergency SOS Alert', ?, 0, 'Call Patient Immediately', 'Just now', ?)
    `, [id, patientId, patientName, `Emergency button triggered by ${patientName} (${reason}). Caregiver & contacts notified.`, now]);

    const createdAlert = {
      id,
      patientId,
      patientName,
      type: 'missed_medication',
      severity: 'emergency',
      title: '🚨 Immediate Emergency SOS Alert',
      description: `Emergency button triggered by ${patientName} (${reason}). Caregiver & contacts notified.`,
      reviewed: false,
      actionText: 'Call Patient Immediately',
      timestamp: 'Just now',
    };

    return res.status(201).json(createdAlert);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to dispatch SOS alert' });
  }
});
