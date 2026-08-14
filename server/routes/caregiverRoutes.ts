import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { redeemConnectionCode } from '../services/connectionCodeService';

export const caregiverRouter = Router();

// GET all linked patients for caregiver
caregiverRouter.get('/patients', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ error: 'Access denied: Caregiver role required' });
    }

    const caregiverId = req.user.userId;

    const patients = db.prepare(`
      SELECT u.id, u.name, u.age, u.avatar_url as avatarUrl,
             u.primary_caregiver as primaryCaregiver, u.caregiver_phone as caregiverPhone,
             u.emergency_contact as emergencyContact, u.emergency_phone as emergencyPhone,
             u.quiet_hours as quietHours,
             (SELECT COUNT(*) FROM medications m WHERE m.patient_id = u.id AND m.active = 1) as medicationCount
      FROM users u
      JOIN caregiver_patient_links cpl ON u.id = cpl.patient_id
      WHERE cpl.caregiver_id = ?
    `).all(caregiverId) as any[];

    return res.json(patients.map((p) => ({
      ...p,
      lastActive: 'Just now',
      status: 'normal',
    })));
  } catch (err: any) {
    console.error('Error fetching caregiver patients:', err);
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET patient summary by ID (verifying link authorization)
caregiverRouter.get('/patient/:id/summary', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ error: 'Access denied: Caregiver role required' });
    }

    const caregiverId = req.user.userId;
    const patientId = req.params.id;

    const isLinked = db.prepare(`
      SELECT id FROM caregiver_patient_links
      WHERE caregiver_id = ? AND patient_id = ?
    `).get(caregiverId, patientId);

    if (!isLinked) {
      return res.status(403).json({ error: 'Access denied: Patient is not linked to this caregiver' });
    }

    const patient = db.prepare('SELECT id, name, age, avatar_url as avatarUrl, primary_caregiver as primaryCaregiver, caregiver_phone as caregiverPhone, emergency_contact as emergencyContact, emergency_phone as emergencyPhone, quiet_hours as quietHours FROM users WHERE id = ?').get(patientId);
    return res.json(patient);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch patient summary' });
  }
});

// POST link new patient via secure Connection Code
caregiverRouter.post('/link-patient', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ error: 'Access denied: Caregiver role required' });
    }

    const caregiverId = req.user.userId;
    const { linkCode, connectionCode, code } = req.body;
    const codeToRedeem = code || connectionCode || linkCode;

    if (!codeToRedeem) {
      return res.status(400).json({ error: 'Caregiver connection code is required (e.g. CARE-7K4P9Q)' });
    }

    const result = redeemConnectionCode(caregiverId, codeToRedeem);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Invalid or expired connection code' });
    }

    return res.json({
      success: true,
      message: `Successfully linked to ${result.patient.name}`,
      patient: result.patient,
    });
  } catch (err: any) {
    console.error('Error linking patient:', err);
    return res.status(500).json({ error: 'Failed to link patient' });
  }
});
