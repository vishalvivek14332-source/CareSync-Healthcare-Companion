import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';
import { getActiveConnectionCode, createConnectionCodeForPatient, revokeConnectionCode } from '../services/connectionCodeService';
import { saveProfileAvatar } from '../services/storageService';

export const patientRouter = Router();

// GET /api/patient/profile
patientRouter.get('/profile', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const user = db.prepare(`
      SELECT id, email, role, name, age, phone, avatar_url as avatarUrl, timezone, primary_caregiver as primaryCaregiver,
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

// PUT /api/patient/profile
patientRouter.put('/profile', (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const { name, age, primaryCaregiver, caregiverPhone, emergencyContact, emergencyPhone, quietHours, timezone } = req.body;

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          age = COALESCE(?, age),
          primary_caregiver = COALESCE(?, primary_caregiver),
          caregiver_phone = COALESCE(?, caregiver_phone),
          emergency_contact = COALESCE(?, emergency_contact),
          emergency_phone = COALESCE(?, emergency_phone),
          quiet_hours = COALESCE(?, quiet_hours),
          timezone = COALESCE(?, timezone)
      WHERE id = ?
    `).run(
      name ?? null,
      age ?? null,
      primaryCaregiver ?? null,
      caregiverPhone ?? null,
      emergencyContact ?? null,
      emergencyPhone ?? null,
      quietHours ?? null,
      timezone ?? null,
      patientId
    );

    const updated = db.prepare(`
      SELECT id, email, role, name, age, phone, avatar_url as avatarUrl, timezone, primary_caregiver as primaryCaregiver,
             caregiver_phone as caregiverPhone, emergency_contact as emergencyContact,
             emergency_phone as emergencyPhone, quiet_hours as quietHours
      FROM users WHERE id = ?
    `).get(patientId);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update patient profile' });
  }
});

// PUT /api/patient/avatar - Save profile photo using object storage abstraction
patientRouter.put('/avatar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { avatarUrl } = req.body;
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl is required' });
    }

    let finalUrl = avatarUrl;
    if (avatarUrl.startsWith('data:image/')) {
      const uploadResult = await saveProfileAvatar(avatarUrl, userId);
      finalUrl = uploadResult.url;
    }

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(finalUrl, userId);

    return res.json({ success: true, avatarUrl: finalUrl });
  } catch (err: any) {
    console.error('Update avatar error:', err);
    return res.status(400).json({ error: err.message || 'Failed to update profile photo' });
  }
});

// GET /api/patient/connection-code
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

// POST /api/patient/connection-code/generate
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

// POST /api/patient/connection-code/revoke
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
