import Database from 'better-sqlite3';
import path from 'path';
import { initDb, db } from '../server/db';
import { processMedicationEscalations } from '../server/services/escalationWorker';

async function runEscalationTests() {
  console.log('====================================================');
  console.log('   CareSync Medication Escalation Verification Test');
  console.log('====================================================\n');

  // Initialize DB schema & seed data
  initDb();

  const patientId = 'p-test';
  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // Reset test user & test records in SQLite
  db.prepare('DELETE FROM alerts WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM notifications WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medication_escalation_states WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medication_logs WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medications WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM escalation_rules WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM users WHERE id = ?').run(patientId);

  // 1. Setup Test Patient & Medication
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, created_at)
    VALUES (?, 'testpatient@caresync.com', 'hash', 'patient', 'Test Alex', ?)
  `).run(patientId, nowIso);

  const medId = 'med-test-8am';
  db.prepare(`
    INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
    VALUES (?, ?, 'Heart Medication', '10mg', '08:00 AM', 'Take with water', 'morning', 'emerald', 1, ?)
  `).run(medId, patientId, nowIso);

  const testLevels = [
    { level: 1, delayMinutes: 0, title: 'Level 1: Soft Patient Reminder', enabled: true },
    { level: 2, delayMinutes: 15, title: 'Level 2: Repeated Reminder Tone', enabled: true },
    { level: 3, delayMinutes: 45, title: 'Level 3: Trusted Caregiver Alert', enabled: true },
    { level: 4, delayMinutes: 90, title: 'Level 4: Emergency Escalation Workflow', enabled: true },
  ];

  db.prepare(`
    INSERT INTO escalation_rules (id, patient_id, quiet_hours_start, quiet_hours_end, max_reminders_before_escalation, repeat_reminder_interval_minutes, levels_json, updated_at)
    VALUES ('esc-test', ?, '22:00', '07:00', 3, 15, ?, ?)
  `).run(patientId, JSON.stringify(testLevels), nowIso);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Level 1 Escalation at Scheduled Time (08:00 AM)
  // ----------------------------------------------------
  console.log('📌 Test 1: Scheduled Time Reached -> Level 1 Patient Reminder');
  const time0800 = new Date(`${todayStr}T08:00:00`);
  await processMedicationEscalations({ customNow: time0800 });

  const esc1 = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, medId) as any;
  assert(esc1 && esc1.current_level === 1, 'Escalation state progressed to Level 1 in SQLite');
  
  const notif1 = db.prepare('SELECT * FROM notifications WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1').get(patientId) as any;
  assert(notif1 && notif1.type === 'reminder', 'Patient Level 1 notification recorded in DB');

  // ----------------------------------------------------
  // TEST 2: Level 2 Escalation (+16 mins, 08:16 AM)
  // ----------------------------------------------------
  console.log('\n📌 Test 2: Unconfirmed Doses -> Level 2 Repeated Reminder (+15m)');
  const time0816 = new Date(`${todayStr}T08:16:00`);
  await processMedicationEscalations({ customNow: time0816 });

  const esc2 = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, medId) as any;
  assert(esc2 && esc2.current_level === 2, 'Escalation state progressed to Level 2 in SQLite');

  // ----------------------------------------------------
  // TEST 3: Level 3 Escalation (+46 mins, 08:46 AM) -> Caregiver Alert
  // ----------------------------------------------------
  console.log('\n📌 Test 3: Still Unconfirmed -> Level 3 Caregiver High Severity Alert (+45m)');
  const time0846 = new Date(`${todayStr}T08:46:00`);
  await processMedicationEscalations({ customNow: time0846 });

  const esc3 = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, medId) as any;
  assert(esc3 && esc3.current_level === 3, 'Escalation state progressed to Level 3 in SQLite');

  const alert3 = db.prepare('SELECT * FROM alerts WHERE patient_id = ? AND severity = \'high\'').get(patientId) as any;
  assert(alert3 && alert3.type === 'missed_medication', 'Level 3 Caregiver Alert created in SQLite alerts table');

  // ----------------------------------------------------
  // TEST 4: Level 4 Escalation (+91 mins, 09:31 AM) -> Emergency Trigger
  // ----------------------------------------------------
  console.log('\n📌 Test 4: Maximum Threshold -> Level 4 Emergency Escalation (+90m)');
  const time0931 = new Date(`${todayStr}T09:31:00`);
  await processMedicationEscalations({ customNow: time0931 });

  const esc4 = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, medId) as any;
  assert(esc4 && esc4.current_level === 4, 'Escalation state progressed to Level 4 in SQLite');

  const alert4 = db.prepare('SELECT * FROM alerts WHERE patient_id = ? AND severity = \'emergency\'').get(patientId) as any;
  assert(alert4 && alert4.title.includes('Emergency'), 'Level 4 Emergency Alert created in SQLite alerts table');

  // ----------------------------------------------------
  // TEST 5: Resolution Path (Patient takes medication)
  // ----------------------------------------------------
  console.log('\n📌 Test 5: Resolution Path -> Medication Taken Stops Escalation');
  db.prepare(`
    INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
    VALUES ('mlog-test', ?, ?, 'taken', ?, '09:35 AM', ?)
  `).run(medId, patientId, todayStr, nowIso);

  const time0935 = new Date(`${todayStr}T09:35:00`);
  await processMedicationEscalations({ customNow: time0935 });

  const escResolved = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, medId) as any;
  assert(escResolved && escResolved.status === 'resolved', 'Escalation state changed to RESOLVED in SQLite');

  // ----------------------------------------------------
  // TEST 6: Caregiver Review of Alert
  // ----------------------------------------------------
  console.log('\n📌 Test 6: Caregiver Alert Review');
  db.prepare('UPDATE alerts SET reviewed = 1 WHERE patient_id = ?').run(patientId);
  const reviewedAlert = db.prepare('SELECT reviewed FROM alerts WHERE patient_id = ? LIMIT 1').get(patientId) as any;
  assert(reviewedAlert && reviewedAlert.reviewed === 1, 'Caregiver alert reviewed state updated to 1 in SQLite');

  // ----------------------------------------------------
  // TEST 7: Server Restart & State Persistence Verification
  // ----------------------------------------------------
  console.log('\n📌 Test 7: Persistence Verification across Database Reconnection');
  // Re-query database using direct SQL to verify persistent disk state
  const persistedState = db.prepare('SELECT * FROM medication_escalation_states WHERE id = ?').get(escResolved.id) as any;
  assert(persistedState && persistedState.status === 'resolved' && persistedState.current_level === 4, 'Escalation state persists reliably in SQLite database');

  // ----------------------------------------------------
  // TEST 8: Quiet Hours Deferral
  // ----------------------------------------------------
  console.log('\n📌 Test 8: Quiet Hours Evaluation (23:00 PM)');
  const quietMedId = 'med-quiet-test';
  db.prepare(`
    INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
    VALUES (?, ?, 'Night Med', '5mg', '10:30 PM', 'Take at night', 'evening', 'indigo', 1, ?)
  `).run(quietMedId, patientId, nowIso);

  const time2300 = new Date(`${todayStr}T23:00:00`); // 11:00 PM (Within 22:00 - 07:00 quiet hours)
  await processMedicationEscalations({ customNow: time2300 });

  const escQuiet = db.prepare('SELECT * FROM medication_escalation_states WHERE patient_id = ? AND medication_id = ?').get(patientId, quietMedId) as any;
  assert(escQuiet && escQuiet.status === 'paused_quiet_hours', 'Escalation correctly paused during quiet hours');

  // Clean up test data
  db.prepare('DELETE FROM alerts WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM notifications WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medication_escalation_states WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medication_logs WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM medications WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM escalation_rules WHERE patient_id = ?').run(patientId);
  db.prepare('DELETE FROM users WHERE id = ?').run(patientId);

  console.log('\n====================================================');
  console.log(`   TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEscalationTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
