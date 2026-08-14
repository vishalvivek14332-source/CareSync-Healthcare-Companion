import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';

export const hydrationRouter = Router();

hydrationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = (req.query.patientId as string) || req.user?.userId || 'p-1';
    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch today's logs
    const logs = db.prepare(`
      SELECT id, amount_ml as amountMl, timestamp
      FROM hydration_logs
      WHERE patient_id = ? AND date(logged_at) = date('now')
      ORDER BY logged_at DESC
    `).all(patientId) as any[];

    const totalMl = logs.reduce((sum, log) => sum + log.amountMl, 0);
    const currentLiters = Number((totalMl / 1000).toFixed(2));

    const hourlyTrends = [
      { hour: '8 AM', liters: 0.25 },
      { hour: '10 AM', liters: 0.65 },
      { hour: '12 PM', liters: 0.9 },
      { hour: '2 PM', liters: Math.min(currentLiters, 1.4) },
      { hour: '4 PM', liters: currentLiters },
      { hour: '6 PM', liters: currentLiters },
    ];

    return res.json({
      currentLiters,
      goalLiters: 2.0,
      nextReminderTime: 'In 45 minutes',
      logs,
      hourlyTrends,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch hydration state' });
  }
});

hydrationRouter.post('/log', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.userId || 'p-1';
    const { amountMl } = req.body;

    if (!amountMl || typeof amountMl !== 'number') {
      return res.status(400).json({ error: 'Valid amountMl is required' });
    }

    const id = `h-${Date.now()}`;
    const now = new Date().toISOString();
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    db.prepare(`
      INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, patientId, amountMl, timestampStr, now);

    return res.status(201).json({ id, amountMl, timestamp: timestampStr });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to log water intake' });
  }
});
