import { db } from '../db';
import { NotificationService } from './notificationService';
import { isQuietHours, parseTimeStringToMinutes } from './quietHours';

export interface EscalationConfigOptions {
  customNow?: Date;
  testMode?: boolean;
  timeMultiplier?: number; // E.g., 60 means 1 real second = 1 test minute
}

let workerTimer: NodeJS.Timeout | null = null;

export async function processMedicationEscalations(options: EscalationConfigOptions = {}) {
  const now = options.customNow || new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Fetch all active medications for today across all patients
  const activeMedications = db.prepare(`
    SELECT m.id as medicationId, m.patient_id as patientId, m.name as medicationName,
           m.dosage, m.scheduled_time as scheduledTime, u.name as patientName
    FROM medications m
    JOIN users u ON m.patient_id = u.id
    WHERE m.active = 1
  `).all() as any[];

  for (const med of activeMedications) {
    const { medicationId, patientId, medicationName, dosage, scheduledTime, patientName } = med;

    // Check medication log status for today
    const medLog = db.prepare(`
      SELECT status, taken_at FROM medication_logs
      WHERE medication_id = ? AND scheduled_date = ?
    `).get(medicationId, todayStr) as any;

    const isTaken = medLog && medLog.status === 'taken';

    // Fetch existing escalation state for today's dose
    let escState = db.prepare(`
      SELECT * FROM medication_escalation_states
      WHERE patient_id = ? AND medication_id = ? AND scheduled_date = ?
    `).get(patientId, medicationId, todayStr) as any;

    // If medication is marked TAKEN, resolve any active escalation immediately!
    if (isTaken) {
      if (escState && escState.status !== 'resolved') {
        db.prepare(`
          UPDATE medication_escalation_states
          SET status = 'resolved', updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), escState.id);
        console.log(`[EscalationWorker] Escalation RESOLVED for ${medicationName} (${patientName}) - Dose Confirmed.`);
      }
      continue;
    }

    // Convert scheduled time (e.g. "08:00 AM" or "13:00") to minutes
    const scheduledMins = parseTimeStringToMinutes(scheduledTime);

    // If scheduled time has not arrived yet today, skip
    if (currentMinutes < scheduledMins) {
      continue;
    }

    // Fetch patient's escalation rules
    const rulesRecord = db.prepare(`
      SELECT * FROM escalation_rules WHERE patient_id = ?
    `).get(patientId) as any;

    const quietHoursStart = rulesRecord?.quiet_hours_start || '22:00';
    const quietHoursEnd = rulesRecord?.quiet_hours_end || '07:00';
    const isQuiet = isQuietHours(currentMinutes, quietHoursStart, quietHoursEnd);

    const levels = rulesRecord?.levels_json ? JSON.parse(rulesRecord.levels_json) : [
      { level: 1, delayMinutes: 0, title: 'Level 1: Soft Patient Reminder', enabled: true },
      { level: 2, delayMinutes: 15, title: 'Level 2: Repeated Reminder Tone', enabled: true },
      { level: 3, delayMinutes: 45, title: 'Level 3: Trusted Caregiver Alert', enabled: true },
      { level: 4, delayMinutes: 90, title: 'Level 4: Emergency Escalation Workflow', enabled: true },
    ];

    // Ensure escalation state entry exists in database
    if (!escState) {
      const stateId = `escstate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      db.prepare(`
        INSERT INTO medication_escalation_states
        (id, patient_id, medication_id, scheduled_date, scheduled_time, current_level, last_escalated_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, NULL, 'active', ?, ?)
      `).run(stateId, patientId, medicationId, todayStr, scheduledTime, now.toISOString(), now.toISOString());

      escState = {
        id: stateId,
        patient_id: patientId,
        medication_id: medicationId,
        scheduled_date: todayStr,
        scheduled_time: scheduledTime,
        current_level: 0,
        last_escalated_at: null,
        status: 'active',
      };
    }

    // If escalation was already resolved, skip
    if (escState.status === 'resolved') {
      continue;
    }

    // Calculate elapsed minutes since scheduled time
    let elapsedMinutes = currentMinutes - scheduledMins;
    if (options.testMode && options.timeMultiplier) {
      // Accelerate elapsed minutes for fast automated tests
      elapsedMinutes = elapsedMinutes * options.timeMultiplier;
    }

    // If quiet hours active, pause non-emergency notifications
    if (isQuiet && escState.current_level < 3) {
      if (escState.status !== 'paused_quiet_hours') {
        db.prepare(`
          UPDATE medication_escalation_states
          SET status = 'paused_quiet_hours', updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), escState.id);
        console.log(`[EscalationWorker] Escalation PAUSED during quiet hours for ${patientName}`);
      }
      continue;
    } else if (escState.status === 'paused_quiet_hours') {
      db.prepare(`
        UPDATE medication_escalation_states
        SET status = 'active', updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), escState.id);
    }

    const currentLevel = escState.current_level || 0;

    // LEVEL 1 EVALUATION
    const level1Config = levels.find((l: any) => l.level === 1);
    if (currentLevel < 1 && level1Config && level1Config.enabled) {
      if (elapsedMinutes >= (level1Config.delayMinutes || 0)) {
        NotificationService.notifyPatient(
          patientId,
          `Reminder: ${medicationName}`,
          `It's time for your ${medicationName} (${dosage}). Please confirm when taken.`,
          'reminder'
        );

        db.prepare(`
          UPDATE medication_escalation_states
          SET current_level = 1, last_escalated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), now.toISOString(), escState.id);

        console.log(`[EscalationWorker] Escalated to Level 1 for ${medicationName} (${patientName})`);
        continue;
      }
    }

    // LEVEL 2 EVALUATION
    const level2Config = levels.find((l: any) => l.level === 2);
    if (currentLevel === 1 && level2Config && level2Config.enabled) {
      if (elapsedMinutes >= (level2Config.delayMinutes || 15)) {
        NotificationService.notifyPatient(
          patientId,
          `Urgent Reminder: ${medicationName}`,
          `Second Notice: Please take your ${medicationName} (${dosage}) scheduled for ${scheduledTime}.`,
          'reminder'
        );

        db.prepare(`
          UPDATE medication_escalation_states
          SET current_level = 2, last_escalated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), now.toISOString(), escState.id);

        console.log(`[EscalationWorker] Escalated to Level 2 for ${medicationName} (${patientName})`);
        continue;
      }
    }

    // LEVEL 3 EVALUATION (Caregiver Alert)
    const level3Config = levels.find((l: any) => l.level === 3);
    if (currentLevel === 2 && level3Config && level3Config.enabled) {
      if (elapsedMinutes >= (level3Config.delayMinutes || 45)) {
        NotificationService.notifyCaregiver(
          patientId,
          `Missed Medication Alert: ${medicationName}`,
          `${patientName} has not confirmed ${medicationName} (${dosage}) scheduled for ${scheduledTime} after multiple reminders.`,
          'Contact Patient'
        );

        db.prepare(`
          UPDATE medication_escalation_states
          SET current_level = 3, last_escalated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), now.toISOString(), escState.id);

        console.log(`[EscalationWorker] Escalated to Level 3 (Caregiver Alert) for ${medicationName} (${patientName})`);
        continue;
      }
    }

    // LEVEL 4 EVALUATION (Emergency Escalation)
    const level4Config = levels.find((l: any) => l.level === 4);
    if (currentLevel === 3 && level4Config && level4Config.enabled) {
      if (elapsedMinutes >= (level4Config.delayMinutes || 90)) {
        NotificationService.notifyEmergency(
          patientId,
          `🚨 Emergency Escalation: ${medicationName}`,
          `Critical Alert: Unconfirmed medication ${medicationName} for ${patientName} reached emergency escalation limit.`,
          'Immediate Call'
        );

        db.prepare(`
          UPDATE medication_escalation_states
          SET current_level = 4, last_escalated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), now.toISOString(), escState.id);

        console.log(`[EscalationWorker] Escalated to Level 4 (EMERGENCY) for ${medicationName} (${patientName})`);
        continue;
      }
    }
  }
}

export function startEscalationWorker(intervalMs = 30000) {
  if (workerTimer) return;
  console.log(`[EscalationWorker] Background escalation worker initialized (Interval: ${intervalMs}ms)`);
  
  // Initial immediate run
  processMedicationEscalations().catch(console.error);

  workerTimer = setInterval(() => {
    processMedicationEscalations().catch(console.error);
  }, intervalMs);
}

export function stopEscalationWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[EscalationWorker] Background escalation worker stopped.');
  }
}
