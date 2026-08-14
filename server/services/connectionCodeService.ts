import crypto from 'crypto';
import { db } from '../db';

/**
 * Generate a cryptographically random, uppercase connection code
 * Format: CARE-XXXXXX (e.g. CARE-7K4P9Q)
 */
export function generateRandomCodeString(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars 0, 1, I, O
  let result = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `CARE-${result}`;
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * Generate a new connection code for a patient.
 * Automatically revokes any previous active codes for this patient.
 */
export function createConnectionCodeForPatient(patientId: string, expiresInDays = 7): { code: string; expiresAt: string } {
  const now = new Date();
  const expiresAtDate = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const expiresAtIso = expiresAtDate.toISOString();

  // Revoke previous active codes for this patient
  db.prepare(`
    UPDATE care_connection_codes
    SET revoked_at = ?
    WHERE patient_id = ? AND revoked_at IS NULL
  `).run(nowIso, patientId);

  const rawCode = generateRandomCodeString();
  const codeHash = hashCode(rawCode);
  const codeId = `code-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  db.prepare(`
    INSERT INTO care_connection_codes (id, patient_id, code_hash, code_display, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(codeId, patientId, codeHash, rawCode, expiresAtIso, nowIso);

  return {
    code: rawCode,
    expiresAt: expiresAtIso,
  };
}

/**
 * Fetch the current active connection code for a patient.
 */
export function getActiveConnectionCode(patientId: string): { code: string; expiresAt: string; createdAt: string } | null {
  const nowIso = new Date().toISOString();
  const row = db.prepare(`
    SELECT code_display as code, expires_at as expiresAt, created_at as createdAt
    FROM care_connection_codes
    WHERE patient_id = ? AND revoked_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(patientId, nowIso) as any;

  return row || null;
}

/**
 * Revoke the current connection code for a patient.
 */
export function revokeConnectionCode(patientId: string): boolean {
  const nowIso = new Date().toISOString();
  const res = db.prepare(`
    UPDATE care_connection_codes
    SET revoked_at = ?
    WHERE patient_id = ? AND revoked_at IS NULL
  `).run(nowIso, patientId);

  return res.changes > 0;
}

/**
 * Validate a connection code and link the caregiver to the patient.
 */
export function redeemConnectionCode(caregiverId: string, inputCode: string): { success: boolean; patient?: any; error?: string } {
  if (!inputCode || typeof inputCode !== 'string') {
    return { success: false, error: 'Connection code is required' };
  }

  const cleanCode = inputCode.trim().toUpperCase();
  const codeHash = hashCode(cleanCode);
  const nowIso = new Date().toISOString();

  // Find valid active code
  const codeRecord = db.prepare(`
    SELECT c.*, u.id as patientId, u.name as patientName, u.email as patientEmail, u.phone as patientPhone
    FROM care_connection_codes c
    JOIN users u ON c.patient_id = u.id
    WHERE (c.code_hash = ? OR c.code_display = ?)
      AND c.revoked_at IS NULL
      AND c.expires_at > ?
  `).get(codeHash, cleanCode, nowIso) as any;

  if (!codeRecord) {
    return { success: false, error: 'Invalid, expired, or revoked connection code' };
  }

  const patientId = codeRecord.patient_id;

  // Check if link already exists
  const existingLink = db.prepare(`
    SELECT id FROM caregiver_patient_links
    WHERE caregiver_id = ? AND patient_id = ?
  `).get(caregiverId, patientId);

  if (!existingLink) {
    const linkId = `link-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO caregiver_patient_links (id, caregiver_id, patient_id, link_code, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(linkId, caregiverId, patientId, cleanCode, nowIso);
  }

  // Mark code as used
  db.prepare(`
    UPDATE care_connection_codes
    SET used_at = ?
    WHERE id = ?
  `).run(nowIso, codeRecord.id);

  const patient = db.prepare(`
    SELECT id, name, age, email, phone, avatar_url as avatarUrl, primary_caregiver as primaryCaregiver,
           caregiver_phone as caregiverPhone, emergency_contact as emergencyContact,
           emergency_phone as emergencyPhone, quiet_hours as quietHours
    FROM users WHERE id = ?
  `).get(patientId);

  return {
    success: true,
    patient,
  };
}
