import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getActiveConnectionCode, createConnectionCodeForPatient, revokeConnectionCode } from '../services/connectionCodeService';

export const patientRouter = Router();

patientRouter.get('/profile', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId as string || req.user?.userId || 'p-1';
    const user = db.prepare(`
      SELECT id, name, age, avatar_url as avatarUrl, primary_caregiver as primaryCaregiver,
             caregiver_phone as caregiverPhone, emergency_contact as emergencyContact,
             emergency_phone as emergencyPhone, quiet_hours as quietHours
      FROM users WHERE id = ?
    `).get(patientId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const medCount = (db.prepare('SELECT COUNT(*) as count FROM medications WHERE patient_id = ? AND active = 1').get(patientId) as any).count;

    const profile = {
      ...user,
      medicationCount: medCount,
      lastActive: 'Just now',
      status: 'normal',
    };

    return res.json(profile);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch patient profile' });
  }
});

patientRouter.put('/profile', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.userId || 'p-1';
    const { name, age, primaryCaregiver, caregiverPhone, emergencyContact, emergencyPhone, quietHours } = req.body;

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          age = COALESCE(?, age),
          primary_caregiver = COALESCE(?, primary_caregiver),
          caregiver_phone = COALESCE(?, caregiver_phone),
          emergency_contact = COALESCE(?, emergency_contact),
          emergency_phone = COALESCE(?, emergency_phone),
          quiet_hours = COALESCE(?, quiet_hours)
      WHERE id = ?
    `).run(name, age, primaryCaregiver, caregiverPhone, emergencyContact, emergencyPhone, quietHours, patientId);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(patientId);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update patient profile' });
  }
});

// GET active connection code for current patient
patientRouter.get('/connection-code', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can view connection codes' });
    }

    const patientId = req.user.userId;
    let codeInfo = getActiveConnectionCode(patientId);
    if (!codeInfo) {
      codeInfo = createConnectionCodeForPatient(patientId) as any;
    }

    return res.json(codeInfo);
  } catch (err: any) {
    console.error('Error fetching connection code:', err);
    return res.status(500).json({ error: 'Failed to fetch connection code' });
  }
});

// POST generate new connection code (revokes old ones)
patientRouter.post('/connection-code/generate', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can generate connection codes' });
    }

    const patientId = req.user.userId;
    const newCodeInfo = createConnectionCodeForPatient(patientId);
    return res.json({ success: true, ...newCodeInfo });
  } catch (err: any) {
    console.error('Error generating connection code:', err);
    return res.status(500).json({ error: 'Failed to generate connection code' });
  }
});

// POST revoke connection code
patientRouter.post('/connection-code/revoke', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can revoke connection codes' });
    }

    const patientId = req.user.userId;
    const revoked = revokeConnectionCode(patientId);
    return res.json({ success: true, revoked });
  } catch (err: any) {
    console.error('Error revoking connection code:', err);
    return res.status(500).json({ error: 'Failed to revoke connection code' });
  }
});
