import { queryRow, executeSql } from '../db';

export interface NotificationPayload {
  patientId: string;
  title: string;
  description: string;
  type: 'reminder' | 'alert' | 'system' | 'caregiver' | 'emergency';
}

export class NotificationService {
  /**
   * Dispatch patient notification (reminders, visual chimes, full screen alerts)
   */
  static async notifyPatient(patientId: string, title: string, description: string, type: 'reminder' | 'alert' | 'system' | 'caregiver' | 'emergency' = 'reminder') {
    const id = `n-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await executeSql(`
      INSERT INTO notifications (id, patient_id, title, description, timestamp, type, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `, [id, patientId, title, description, timestampStr, type, nowIso]);

    console.log(`[NotificationService:PATIENT] Patient ${patientId} -> ${title}: ${description}`);
    return { id, patientId, title, description, timestamp: timestampStr, type };
  }

  /**
   * Dispatch caregiver notification (Level 3 high-priority alert)
   */
  static async notifyCaregiver(patientId: string, title: string, description: string, actionText = 'Contact Patient') {
    const alertId = `alt-c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const timestampStr = 'Just now';

    const patient = await queryRow<any>('SELECT name FROM users WHERE id = ?', [patientId]);
    const patientName = patient?.name || 'Patient';

    // Insert alert into alerts table for caregiver dashboard
    await executeSql(`
      INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
      VALUES (?, ?, ?, 'missed_medication', 'high', ?, ?, 0, ?, ?, ?)
    `, [alertId, patientId, patientName, title, description, actionText, timestampStr, nowIso]);

    // Also record in notifications table
    await this.notifyPatient(patientId, title, description, 'caregiver');

    console.log(`[NotificationService:CAREGIVER] Patient ${patientId} (${patientName}) -> Caregiver Alert: ${title}`);
    return { alertId, patientId, title, description };
  }

  /**
   * Dispatch emergency notification (Level 4 emergency workflow)
   */
  static async notifyEmergency(patientId: string, title: string, description: string, actionText = 'Immediate Emergency Call') {
    const alertId = `alt-emg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const timestampStr = 'Just now';

    const patient = await queryRow<any>('SELECT name FROM users WHERE id = ?', [patientId]);
    const patientName = patient?.name || 'Patient';

    // Insert emergency alert
    await executeSql(`
      INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
      VALUES (?, ?, ?, 'missed_medication', 'emergency', ?, ?, 0, ?, ?, ?)
    `, [alertId, patientId, patientName, title, description, actionText, timestampStr, nowIso]);

    // Record emergency notification
    await this.notifyPatient(patientId, title, description, 'emergency');

    console.log(`[NotificationService:EMERGENCY] 🚨 Patient ${patientId} (${patientName}) -> EMERGENCY TRIGGER: ${title}`);
    return { alertId, patientId, title, description };
  }
}
