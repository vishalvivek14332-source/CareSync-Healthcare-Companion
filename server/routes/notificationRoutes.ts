import { Router, Response } from 'express';
import { queryRow, queryRows, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';
import { registerDevicePushToken } from '../services/fcmService';

export const notificationRouter = Router();

// GET /api/notifications
notificationRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const notifications = await queryRows<any>(`
      SELECT id, title, description, timestamp, type, read
      FROM notifications
      WHERE patient_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [patientId]);

    return res.json(notifications.map((n) => ({ ...n, read: Boolean(n.read) })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/register-token - Register FCM push token for authenticated user
notificationRouter.post('/register-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token, platform = 'android' } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Device push token is required' });
    }

    await registerDevicePushToken(userId, token.trim(), platform);
    return res.json({ success: true, message: 'Device push token registered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register push token' });
  }
});

// PUT /api/notifications/:id/read
notificationRouter.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const notif = await queryRow<any>('SELECT patient_id FROM notifications WHERE id = ?', [id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    const patientId = await getAuthorizedPatientId(req, res, notif.patient_id);
    if (!patientId) return;

    await executeSql('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
    return res.json({ success: true, id, read: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// DELETE /api/notifications
notificationRouter.delete('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res);
    if (!patientId) return;

    await executeSql('DELETE FROM notifications WHERE patient_id = ?', [patientId]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to clear notifications' });
  }
});
