import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';
import { registerDevicePushToken } from '../services/fcmService';

export const notificationRouter = Router();

// GET /api/notifications
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

// POST /api/notifications/register-token - Register FCM push token for authenticated user
notificationRouter.post('/register-token', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token, platform = 'android' } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Device push token is required' });
    }

    registerDevicePushToken(userId, token.trim(), platform);
    return res.json({ success: true, message: 'Device push token registered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register push token' });
  }
});

// PUT /api/notifications/:id/read
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

// DELETE /api/notifications
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
