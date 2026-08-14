import { queryRow, queryRows, executeSql } from '../db';
import { isQuietHours } from './quietHours';
import { NotificationService } from './notificationService';
import { sendUserPushNotification } from './fcmService';

let escalationTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

interface ProcessOptions {
  customNow?: Date;
}

export function startEscalationWorker(intervalMs: number = 15000) {
  if (escalationTimer) clearInterval(escalationTimer);
  console.log(`[EscalationWorker] Background escalation worker initialized (Interval: ${intervalMs}ms)`);
  escalationTimer = setInterval(() => {
    processMedicationEscalations().catch((err) => {
      console.error('[EscalationWorker] Error in background escalation cycle:', err);
    });
  }, intervalMs);
}

export function stopEscalationWorker() {
  if (escalationTimer) {
    clearInterval(escalationTimer);
    escalationTimer = null;
    console.log('[EscalationWorker] Escalation worker stopped.');
  }
}

// Convert 12h AM/PM (e.g. 08:00 AM) to today's Date object
export function getDoseScheduledDate(scheduledTimeStr: string, baseDate: Date = new Date()): Date {
  const match = scheduledTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return new Date(baseDate);

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const target = new Date(baseDate);
  target.setHours(hours, minutes, 0, 0);
  return target;
}

export async function processMedicationEscalations(options: ProcessOptions = {}) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = options.customNow || new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // 1. Fetch active patients and medications
    const patients = await queryRows<any>('SELECT id, name, quiet_hours, timezone FROM users WHERE role = ?', ['patient']);

    for (const patient of patients) {
      // Fetch active medications for this patient
      const medications = await queryRows<any>(`
        SELECT id, name, dosage, scheduled_time, timezone
        FROM medications
        WHERE patient_id = ? AND active = 1
      `, [patient.id]);

      // Fetch patient's escalation rules
      const rules = await queryRow<any>('SELECT * FROM escalation_rules WHERE patient_id = ?', [patient.id]);
      const quietStart = rules?.quiet_hours_start || '22:00';
      const quietEnd = rules?.quiet_hours_end || '07:00';
      const inQuietHours = isQuietHours(currentMins, quietStart, quietEnd);

      for (const med of medications) {
        const scheduledDateTime = getDoseScheduledDate(med.scheduled_time, now);
        const minutesOverdue = Math.floor((now.getTime() - scheduledDateTime.getTime()) / (1000 * 60));

        // Check if dose has been taken or snoozed
        const doseLog = await queryRow<any>(`
          SELECT status, taken_at FROM medication_logs
          WHERE medication_id = ? AND scheduled_date = ?
        `, [med.id, todayStr]);

        // Fetch or create escalation state in SQLite/PostgreSQL
        let escState = await queryRow<any>(`
          SELECT * FROM medication_escalation_states
          WHERE patient_id = ? AND medication_id = ? AND scheduled_date = ?
        `, [patient.id, med.id, todayStr]);

        // RESOLUTION: If taken, mark resolved and cease escalations
        if (doseLog && doseLog.status === 'taken') {
          if (escState && escState.status !== 'resolved') {
            await executeSql(`
              UPDATE medication_escalation_states
              SET status = 'resolved', updated_at = ?
              WHERE id = ?
            `, [now.toISOString(), escState.id]);
            console.log(`[EscalationWorker] Escalation RESOLVED for ${med.name} (${patient.name}) - Dose Confirmed.`);
          }
          continue;
        }

        // If scheduled time has not yet arrived, skip
        if (minutesOverdue < 0) {
          continue;
        }

        // QUIET HOURS HANDLING: Pause escalation audio notifications during quiet hours
        if (inQuietHours) {
          if (!escState) {
            const escId = `esc-state-${Date.now()}-${med.id}`;
            await executeSql(`
              INSERT INTO medication_escalation_states
              (id, patient_id, medication_id, scheduled_date, scheduled_time, current_level, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 0, 'paused_quiet_hours', ?, ?)
            `, [escId, patient.id, med.id, todayStr, med.scheduled_time, now.toISOString(), now.toISOString()]);
            console.log(`[EscalationWorker] Escalation initialized as PAUSED during quiet hours for ${patient.name}`);
          } else if (escState.status === 'active') {
            await executeSql(`
              UPDATE medication_escalation_states
              SET status = 'paused_quiet_hours', updated_at = ?
              WHERE id = ?
            `, [now.toISOString(), escState.id]);
            console.log(`[EscalationWorker] Escalation PAUSED during quiet hours for ${patient.name}`);
          }
          continue;
        }

        // Create initial escalation state if not exists
        if (!escState) {
          const escId = `esc-state-${Date.now()}-${med.id}`;
          await executeSql(`
            INSERT INTO medication_escalation_states
            (id, patient_id, medication_id, scheduled_date, scheduled_time, current_level, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)
          `, [escId, patient.id, med.id, todayStr, med.scheduled_time, now.toISOString(), now.toISOString()]);

          escState = await queryRow<any>('SELECT * FROM medication_escalation_states WHERE id = ?', [escId]);
        }

        const currentLevel = parseInt(escState.current_level, 10) || 0;

        // LEVEL 1: Scheduled Time reached (0-14 mins overdue)
        if (minutesOverdue >= 0 && minutesOverdue < 15 && currentLevel < 1) {
          await triggerEscalationLevel1(patient, med, escState, now);
        }
        // LEVEL 2: 15-44 mins overdue -> Urgent Repeated Notice
        else if (minutesOverdue >= 15 && minutesOverdue < 45 && currentLevel < 2) {
          await triggerEscalationLevel2(patient, med, escState, now);
        }
        // LEVEL 3: 45-89 mins overdue -> Trusted Caregiver Alert + Push Notification
        else if (minutesOverdue >= 45 && minutesOverdue < 90 && currentLevel < 3) {
          await triggerEscalationLevel3(patient, med, escState, now);
        }
        // LEVEL 4: 90+ mins overdue -> Critical Emergency Escalation
        else if (minutesOverdue >= 90 && currentLevel < 4) {
          await triggerEscalationLevel4(patient, med, escState, now);
        }
      }
    }
  } catch (err: any) {
    console.error('[EscalationWorker] Escalation process error:', err);
  } finally {
    isProcessing = false;
  }
}

async function triggerEscalationLevel1(patient: any, med: any, escState: any, now: Date) {
  await executeSql(`
    UPDATE medication_escalation_states
    SET current_level = 1, last_escalated_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `, [now.toISOString(), now.toISOString(), escState.id]);

  await NotificationService.notifyPatient(
    patient.id,
    `Reminder: ${med.name}`,
    `It's time for your ${med.name} (${med.dosage}). Please confirm when taken.`,
    'reminder'
  );

  console.log(`[EscalationWorker] Escalated to Level 1 for ${med.name} (${patient.name})`);
}

async function triggerEscalationLevel2(patient: any, med: any, escState: any, now: Date) {
  await executeSql(`
    UPDATE medication_escalation_states
    SET current_level = 2, last_escalated_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `, [now.toISOString(), now.toISOString(), escState.id]);

  await NotificationService.notifyPatient(
    patient.id,
    `Urgent Reminder: ${med.name}`,
    `Second Notice: Please take your ${med.name} (${med.dosage}) scheduled for ${med.scheduled_time}.`,
    'alert'
  );

  console.log(`[EscalationWorker] Escalated to Level 2 for ${med.name} (${patient.name})`);
}

async function triggerEscalationLevel3(patient: any, med: any, escState: any, now: Date) {
  await executeSql(`
    UPDATE medication_escalation_states
    SET current_level = 3, last_escalated_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `, [now.toISOString(), now.toISOString(), escState.id]);

  await NotificationService.notifyCaregiver(
    patient.id,
    `Missed Dose: ${med.name}`,
    `${patient.name} has not confirmed ${med.name} (${med.dosage}) scheduled for ${med.scheduled_time} after multiple reminders.`,
    'Contact Patient'
  );

  // Find linked caregiver and send FCM Push Notification
  const linkedCaregiver = await queryRow<any>('SELECT caregiver_id FROM caregiver_patient_links WHERE patient_id = ? LIMIT 1', [patient.id]);
  if (linkedCaregiver) {
    sendUserPushNotification(linkedCaregiver.caregiver_id, {
      title: `🚨 Caregiver Alert: ${patient.name}`,
      body: `Missed dose: ${med.name} (${med.dosage}) scheduled for ${med.scheduled_time}.`,
      data: { type: 'missed_medication', patientId: patient.id, medicationId: med.id },
    }).catch(() => {});
  }

  console.log(`[EscalationWorker] Escalated to Level 3 (Caregiver Alert) for ${med.name} (${patient.name})`);
}

async function triggerEscalationLevel4(patient: any, med: any, escState: any, now: Date) {
  await executeSql(`
    UPDATE medication_escalation_states
    SET current_level = 4, last_escalated_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `, [now.toISOString(), now.toISOString(), escState.id]);

  const alertId = `alt-emerg-${Date.now()}-${med.id}`;
  const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await executeSql(`
    INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
    VALUES (?, ?, ?, 'emergency_escalation', 'emergency', ?, ?, 0, 'Call Emergency Contact', ?, ?)
  `, [
    alertId,
    patient.id,
    patient.name,
    `🚨 Emergency Escalation: ${med.name}`,
    `Critical Alert: Unconfirmed medication ${med.name} for ${patient.name} reached emergency escalation limit.`,
    timestampStr,
    now.toISOString(),
  ]);

  await NotificationService.notifyPatient(
    patient.id,
    `🚨 Emergency Escalation: ${med.name}`,
    `Critical Alert: Unconfirmed medication ${med.name} for ${patient.name} reached emergency escalation limit.`,
    'emergency'
  );

  console.log(`[EscalationWorker] Escalated to Level 4 (EMERGENCY) for ${med.name} (${patient.name})`);
}
