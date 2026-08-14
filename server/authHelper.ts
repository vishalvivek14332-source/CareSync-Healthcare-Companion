import { Response } from 'express';
import { AuthenticatedRequest } from './auth';
import { queryRow } from './db';

export async function getAuthorizedPatientId(
  req: AuthenticatedRequest,
  res: Response,
  requestedPatientId?: string
): Promise<string | null> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const { userId, role } = req.user;

  // PATIENT ROLE: Can only access their own patient ID
  if (role === 'patient') {
    if (requestedPatientId && requestedPatientId !== userId) {
      res.status(403).json({ error: 'Access denied: Cannot access another patient data' });
      return null;
    }
    return userId;
  }

  // CAREGIVER ROLE: Can access specified patient only if linked in caregiver_patient_links
  if (role === 'caregiver') {
    let targetPatientId = requestedPatientId;
    if (!targetPatientId) {
      const firstLink = await queryRow<any>(
        'SELECT patient_id FROM caregiver_patient_links WHERE caregiver_id = ? LIMIT 1',
        [userId]
      );
      targetPatientId = firstLink?.patient_id;
    }

    if (!targetPatientId) {
      res.status(404).json({ error: 'No linked patients found for caregiver' });
      return null;
    }

    const isLinked = await queryRow<any>(`
      SELECT id FROM caregiver_patient_links
      WHERE caregiver_id = ? AND patient_id = ?
    `, [userId, targetPatientId]);

    if (!isLinked) {
      res.status(403).json({ error: 'Access denied: Patient is not linked to this caregiver' });
      return null;
    }

    return targetPatientId;
  }

  res.status(403).json({ error: 'Access denied' });
  return null;
}
