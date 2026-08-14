import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const notificationRouter = Router();

notificationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const notifications = db.prepare(`
      SELECT id, title, description, timestamp, type, read
      FROM notifications
      WHERE patient_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(patientId) as any[];

    return res.json(notifications.map((n) => ({ ...n, read: Boolean(n.read) })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

notificationRouter.put('/:id/read', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const notif = db.prepare('SELECT patient_id FROM notifications WHERE id = ?').get(id) as any;
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    const patientId = getAuthorizedPatientId(req, res, notif.patient_id);
    if (!patientId) return;

    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    return res.json({ success: true, id, read: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

notificationRouter.delete('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res);
    if (!patientId) return;

    db.prepare('DELETE FROM notifications WHERE patient_id = ?').run(patientId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to clear notifications' });
  }
});
