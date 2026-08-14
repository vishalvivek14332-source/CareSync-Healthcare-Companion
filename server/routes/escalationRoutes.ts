import { Router, Response } from 'express';
import { queryRow, executeSql } from '../db';
import { AuthenticatedRequest } from '../auth';
import { getAuthorizedPatientId } from '../authHelper';

export const escalationRouter = Router();

escalationRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.query.patientId as string);
    if (!patientId) return;

    const rules = await queryRow<any>(`
      SELECT caregiver_name as "caregiverName", caregiver_phone as "caregiverPhone",
             caregiver_email as "caregiverEmail", emergency_contact_name as "emergencyContactName",
             emergency_contact_phone as "emergencyContactPhone", emergency_contact_relation as "emergencyContactRelation",
             quiet_hours_start as "quietHoursStart", quiet_hours_end as "quietHoursEnd",
             max_reminders_before_escalation as "maxRemindersBeforeEscalation",
             repeat_reminder_interval_minutes as "repeatReminderIntervalMinutes",
             levels_json
      FROM escalation_rules
      WHERE patient_id = ?
    `, [patientId]);

    if (!rules) {
      const defaultLevels = [
        { level: 1, title: 'Level 1: Soft Patient Reminder', target: 'Patient (Patient App)', delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
        { level: 2, title: 'Level 2: Repeated Reminder Tone', target: 'Patient (Patient App)', delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
        { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: 'Caregiver', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver.', enabled: true },
        { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
      ];
      return res.json({
        levels: defaultLevels,
        caregiverName: 'Sarah Johnson',
        caregiverPhone: '(555) 019-2831',
        caregiverEmail: 'sarah.johnson@example.com',
        emergencyContactName: 'Sarah Johnson (Daughter)',
        emergencyContactPhone: '(555) 019-2831',
        emergencyContactRelation: 'Daughter & Primary Caregiver',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        maxRemindersBeforeEscalation: 3,
        repeatReminderIntervalMinutes: 15,
      });
    }

    const levels = typeof rules.levels_json === 'string' ? JSON.parse(rules.levels_json || '[]') : (rules.levels_json || []);
    delete rules.levels_json;

    return res.json({ ...rules, levels });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch escalation rules' });
  }
});

escalationRouter.put('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = await getAuthorizedPatientId(req, res, req.body.patientId);
    if (!patientId) return;

    const {
      caregiverName,
      caregiverPhone,
      caregiverEmail,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      quietHoursStart,
      quietHoursEnd,
      maxRemindersBeforeEscalation,
      repeatReminderIntervalMinutes,
      levels,
    } = req.body;

    const now = new Date().toISOString();
    const existing = await queryRow<any>('SELECT id FROM escalation_rules WHERE patient_id = ?', [patientId]);

    if (existing) {
      await executeSql(`
        UPDATE escalation_rules
        SET caregiver_name = COALESCE(?, caregiver_name),
            caregiver_phone = COALESCE(?, caregiver_phone),
            caregiver_email = COALESCE(?, caregiver_email),
            emergency_contact_name = COALESCE(?, emergency_contact_name),
            emergency_contact_phone = COALESCE(?, emergency_contact_phone),
            emergency_contact_relation = COALESCE(?, emergency_contact_relation),
            quiet_hours_start = COALESCE(?, quiet_hours_start),
            quiet_hours_end = COALESCE(?, quiet_hours_end),
            max_reminders_before_escalation = COALESCE(?, max_reminders_before_escalation),
            repeat_reminder_interval_minutes = COALESCE(?, repeat_reminder_interval_minutes),
            levels_json = CASE WHEN ? IS NOT NULL THEN ? ELSE levels_json END,
            updated_at = ?
        WHERE patient_id = ?
      `, [
        caregiverName ?? null,
        caregiverPhone ?? null,
        caregiverEmail ?? null,
        emergencyContactName ?? null,
        emergencyContactPhone ?? null,
        emergencyContactRelation ?? null,
        quietHoursStart ?? null,
        quietHoursEnd ?? null,
        maxRemindersBeforeEscalation ?? null,
        repeatReminderIntervalMinutes ?? null,
        levels ? 'true' : null,
        levels ? JSON.stringify(levels) : null,
        now,
        patientId,
      ]);
    } else {
      await executeSql(`
        INSERT INTO escalation_rules (id, patient_id, caregiver_name, caregiver_phone, caregiver_email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, quiet_hours_start, quiet_hours_end, max_reminders_before_escalation, repeat_reminder_interval_minutes, levels_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `esc-${Date.now()}`,
        patientId,
        caregiverName,
        caregiverPhone,
        caregiverEmail,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        quietHoursStart || '22:00',
        quietHoursEnd || '07:00',
        maxRemindersBeforeEscalation || 3,
        repeatReminderIntervalMinutes || 15,
        JSON.stringify(levels || []),
        now,
      ]);
    }

    return res.json({ success: true, message: 'Escalation rules updated' });
  } catch (err: any) {
    console.error('Error updating escalation rules:', err);
    return res.status(500).json({ error: 'Failed to update escalation rules' });
  }
});
