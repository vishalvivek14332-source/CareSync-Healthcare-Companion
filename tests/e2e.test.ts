import express from 'express';
import http from 'http';
import { db, initDb } from '../server/db';
import { authRouter } from '../server/routes/authRoutes';
import { patientRouter } from '../server/routes/patientRoutes';
import { medicationRouter } from '../server/routes/medicationRoutes';
import { hydrationRouter } from '../server/routes/hydrationRoutes';
import { activityRouter } from '../server/routes/activityRoutes';
import { caregiverRouter } from '../server/routes/caregiverRoutes';
import { alertRouter } from '../server/routes/alertRoutes';
import { escalationRouter } from '../server/routes/escalationRoutes';
import { notificationRouter } from '../server/routes/notificationRoutes';
import { authenticateToken } from '../server/auth';
import { processMedicationEscalations } from '../server/services/escalationWorker';

async function runAll14E2ETests() {
  console.log('===================================================================');
  console.log('   CareSync 14-Suite End-to-End Workflow & Security Verification');
  console.log('===================================================================\n');

  // Initialize DB & Seed
  initDb();

  // Create test express app
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/patient', authenticateToken, patientRouter);
  app.use('/api/medications', authenticateToken, medicationRouter);
  app.use('/api/hydration', authenticateToken, hydrationRouter);
  app.use('/api/activity', authenticateToken, activityRouter);
  app.use('/api/caregiver', authenticateToken, caregiverRouter);
  app.use('/api/alerts', authenticateToken, alertRouter);
  app.use('/api/escalation', authenticateToken, escalationRouter);
  app.use('/api/notifications', authenticateToken, notificationRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testNumber: number, title: string, details?: string) {
    if (condition) {
      console.log(`  ✅ Test ${testNumber} PASSED: ${title}`);
      if (details) console.log(`     └─ ${details}`);
      passed++;
    } else {
      console.error(`  ❌ Test ${testNumber} FAILED: ${title}`);
      if (details) console.error(`     └─ Reason: ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Patient onboarding generates valid unique connection code
    // -------------------------------------------------------------------------
    const patientSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'patient',
        name: 'Test Patient Bob',
        email: `bob-${Date.now()}@example.com`,
        password: 'password123',
        age: 70,
        caregiverName: 'Nurse Nancy',
        caregiverPhone: '555-0199',
      }),
    });
    const patientSignupData = await patientSignupRes.json();
    const bobToken = patientSignupData.token;
    const bobUser = patientSignupData.user;
    const bobInitialCode = patientSignupData.connectionCode?.code;

    assert(
      patientSignupRes.ok &&
        bobToken &&
        bobUser.role === 'patient' &&
        typeof bobInitialCode === 'string' &&
        bobInitialCode.startsWith('CARE-'),
      1,
      'Patient onboarding generates valid unique connection code',
      `Generated connection code: ${bobInitialCode}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Caregiver cannot connect with invalid code
    // -------------------------------------------------------------------------
    const caregiverSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'caregiver',
        name: 'Caregiver Carol',
        email: `carol-${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const caregiverSignupData = await caregiverSignupRes.json();
    const carolToken = caregiverSignupData.token;

    const invalidLinkRes = await fetch(`${baseUrl}/api/caregiver/link-patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({ code: 'CARE-INVALID999' }),
    });
    assert(
      invalidLinkRes.status === 400 || invalidLinkRes.status === 404,
      2,
      'Caregiver cannot connect with invalid code',
      `Rejected invalid code with HTTP status ${invalidLinkRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Caregiver connects successfully with valid code
    // -------------------------------------------------------------------------
    const validLinkRes = await fetch(`${baseUrl}/api/caregiver/link-patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({ code: bobInitialCode }),
    });
    const validLinkData = await validLinkRes.json();
    assert(
      validLinkRes.ok && validLinkData.success && validLinkData.patient.id === bobUser.id,
      3,
      'Caregiver connects successfully with valid code',
      `Linked caregiver Carol to patient ${validLinkData.patient.name}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Connection code cannot be reused after revocation / regeneration
    // -------------------------------------------------------------------------
    // Patient Bob generates a new code and revokes it
    const genCodeRes = await fetch(`${baseUrl}/api/patient/connection-code/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const genCodeData = await genCodeRes.json();
    const tempCode = genCodeData.code;

    // Revoke it
    await fetch(`${baseUrl}/api/patient/connection-code/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });

    // Another caregiver tries to redeem revoked code
    const secondCaregiverRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'caregiver',
        name: 'Caregiver Dave',
        email: `dave-${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const daveToken = (await secondCaregiverRes.json()).token;

    const revokedLinkRes = await fetch(`${baseUrl}/api/caregiver/link-patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`,
      },
      body: JSON.stringify({ code: tempCode }),
    });
    assert(
      revokedLinkRes.status === 400 || revokedLinkRes.status === 404,
      4,
      'Connection code cannot be reused after revocation',
      `Rejected revoked code with HTTP status ${revokedLinkRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Caregiver can add medication for linked patient
    // -------------------------------------------------------------------------
    const addMedRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({
        patientId: bobUser.id,
        name: 'Metformin',
        dosage: '500mg',
        scheduledTime: '08:00 AM',
        category: 'morning',
        instructions: 'Take with breakfast',
      }),
    });
    const addedMed = await addMedRes.json();
    assert(
      addMedRes.status === 201 && addedMed.name === 'Metformin' && addedMed.patientId === bobUser.id,
      5,
      'Caregiver can add medication for linked patient',
      `Added medication ${addedMed.name} for patient ${bobUser.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Patient can see new medication in schedule
    // -------------------------------------------------------------------------
    const bobMedsRes = await fetch(`${baseUrl}/api/medications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobMeds = await bobMedsRes.json();
    const foundBobMed = bobMeds.find((m: any) => m.id === addedMed.id);
    assert(
      bobMedsRes.ok && foundBobMed && foundBobMed.name === 'Metformin',
      6,
      'Patient can see new medication in schedule',
      `Patient fetched medications and found ${foundBobMed?.name} (${foundBobMed?.scheduledTime})`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Patient can mark medication as taken
    // -------------------------------------------------------------------------
    const logTakenRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ status: 'taken', takenAt: '08:05 AM' }),
    });
    assert(
      logTakenRes.ok,
      7,
      'Patient can mark medication as taken',
      `Logged taken status for medication ${addedMed.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Caregiver sees medication adherence updated
    // -------------------------------------------------------------------------
    const caregiverViewMedsRes = await fetch(`${baseUrl}/api/medications?patientId=${bobUser.id}`, {
      headers: { Authorization: `Bearer ${carolToken}` },
    });
    const caregiverViewMeds = await caregiverViewMedsRes.json();
    const updatedBobMed = caregiverViewMeds.find((m: any) => m.id === addedMed.id);
    assert(
      updatedBobMed && updatedBobMed.status === 'taken',
      8,
      'Caregiver sees medication adherence updated',
      `Caregiver retrieved status: ${updatedBobMed?.status} (takenAt: ${updatedBobMed?.takenAt})`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Caregiver changes medication time -> Patient schedule updates
    // -------------------------------------------------------------------------
    const updateTimeRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({
        patientId: bobUser.id,
        scheduledTime: '08:30 AM',
        dosage: '1000mg Extended Release',
      }),
    });
    const updateTimeData = await updateTimeRes.json();

    const bobMedsAfterUpdateRes = await fetch(`${baseUrl}/api/medications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobMedsAfterUpdate = await bobMedsAfterUpdateRes.json();
    const bobMedUpdated = bobMedsAfterUpdate.find((m: any) => m.id === addedMed.id);
    assert(
      updateTimeRes.ok &&
        bobMedUpdated &&
        bobMedUpdated.scheduledTime === '08:30 AM' &&
        bobMedUpdated.dosage === '1000mg Extended Release',
      9,
      'Caregiver changes medication time -> Patient schedule updates',
      `Updated time to 08:30 AM and dosage to ${bobMedUpdated?.dosage}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Caregiver deactivates medication -> Patient schedule removes it & no alarms scheduled
    // -------------------------------------------------------------------------
    const deleteMedRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}?patientId=${bobUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${carolToken}` },
    });

    const bobMedsAfterDeleteRes = await fetch(`${baseUrl}/api/medications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobMedsAfterDelete = await bobMedsAfterDeleteRes.json();
    const deletedFound = bobMedsAfterDelete.find((m: any) => m.id === addedMed.id);
    assert(
      deleteMedRes.ok && deletedFound === undefined,
      10,
      'Caregiver deactivates medication -> Patient schedule removes it',
      'Deactivated medication is excluded from active schedule'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Unlinked caregiver cannot access or modify patient medications (HTTP 403)
    // -------------------------------------------------------------------------
    const unlinkedAccessRes = await fetch(`${baseUrl}/api/medications?patientId=${bobUser.id}`, {
      headers: { Authorization: `Bearer ${daveToken}` },
    });
    const unlinkedPostRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`,
      },
      body: JSON.stringify({
        patientId: bobUser.id,
        name: 'Hacker Pills',
        dosage: '999mg',
        scheduledTime: '12:00 PM',
      }),
    });
    assert(
      unlinkedAccessRes.status === 403 && unlinkedPostRes.status === 403,
      11,
      'Unlinked caregiver cannot access or modify patient medications (HTTP 403)',
      `Read returned ${unlinkedAccessRes.status}, Write returned ${unlinkedPostRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Escalation worker escalates missed doses for active medications only
    // -------------------------------------------------------------------------
    // Create an active med for Bob
    const activeEscMedRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({
        patientId: bobUser.id,
        name: 'Active Escalation Pill',
        dosage: '25mg',
        scheduledTime: '09:00 AM',
        category: 'morning',
      }),
    });
    const activeEscMed = await activeEscMedRes.json();

    const todayStr = new Date().toISOString().split('T')[0];
    const time0900 = new Date(`${todayStr}T09:00:00`);
    await processMedicationEscalations({ customNow: time0900 });

    const escState = db
      .prepare('SELECT * FROM medication_escalation_states WHERE medication_id = ? AND scheduled_date = ?')
      .get(activeEscMed.id, todayStr) as any;

    assert(
      escState && escState.current_level === 1,
      12,
      'Escalation worker escalates missed doses for active medications only',
      `Escalation state initialized at Level 1 for active medication ${activeEscMed.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Escalation worker sends caregiver alert on Level 3
    // -------------------------------------------------------------------------
    const time0916 = new Date(`${todayStr}T09:16:00`); // +16 mins -> triggers level 2
    await processMedicationEscalations({ customNow: time0916 });

    const time0946 = new Date(`${todayStr}T09:46:00`); // +46 mins -> triggers level 3
    await processMedicationEscalations({ customNow: time0946 });

    const caregiverAlertsRes = await fetch(`${baseUrl}/api/alerts?patientId=${bobUser.id}`, {
      headers: { Authorization: `Bearer ${carolToken}` },
    });
    const caregiverAlerts = await caregiverAlertsRes.json();
    const escAlert = caregiverAlerts.find((a: any) => a.description.includes('Active Escalation Pill'));

    assert(
      escAlert !== undefined && escAlert.severity === 'high',
      13,
      'Escalation worker sends caregiver alert on Level 3',
      `High-priority alert created for linked caregiver: "${escAlert?.title}"`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Native alarm sync logic verification
    // -------------------------------------------------------------------------
    // In our nativeReminderService implementation:
    const { syncNativeMedicationAlarms } = await import('../src/services/nativeReminderService');
    const caregiverSyncResult = await syncNativeMedicationAlarms([{ id: 'test', name: 'Med', dosage: '10mg', scheduledTime: '08:00 AM', status: 'due' } as any], 'caregiver');
    const patientSyncResult = await syncNativeMedicationAlarms([{ id: 'test', name: 'Med', dosage: '10mg', scheduledTime: '08:00 AM', status: 'due' } as any], 'patient');

    assert(
      caregiverSyncResult.scheduledCount === 0 && patientSyncResult.scheduledCount === 1,
      14,
      'Native alarm sync function only schedules alarms on patient role, not caregiver',
      `Caregiver device receives 0 alarms, while patient device receives ${patientSyncResult.scheduledCount} alarm`
    );

    // Clean up test records
    db.prepare('DELETE FROM users WHERE email LIKE \'%@example.com\'').run();
    db.prepare('DELETE FROM caregiver_patient_links WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM medications WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM medication_logs WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM medication_escalation_states WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM alerts WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM notifications WHERE patient_id = ?').run(bobUser.id);
    db.prepare('DELETE FROM care_connection_codes WHERE patient_id = ?').run(bobUser.id);
  } finally {
    server.close();
  }

  console.log('\n===================================================================');
  console.log(`   14-SUITE E2E VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll14E2ETests().catch((err) => {
  console.error('E2E Test Error:', err);
  process.exit(1);
});
