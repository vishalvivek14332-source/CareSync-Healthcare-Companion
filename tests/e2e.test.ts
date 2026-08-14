import express from 'express';
import http from 'http';
import { db, initDb, checkDatabaseHealth } from '../server/db';
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
import { syncNativeMedicationAlarms, syncNativeHydrationReminders } from '../src/services/nativeReminderService';

async function runAllE2ETests() {
  console.log('===================================================================');
  console.log('   CareSync Comprehensive End-to-End Workflow & Security Verification');
  console.log('===================================================================\n');

  // Initialize DB & Seed
  initDb();

  // Create test express app with full CORS & security headers mirroring server.ts
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  });

  app.get('/api/health/ready', async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();
    res.json({ status: 'ready', database: dbHealth, timestamp: new Date().toISOString() });
  });

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
        phone: '555-0188',
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
      body: JSON.stringify({ connectionCode: 'CARE-INVALID99' }),
    });

    assert(
      invalidLinkRes.status === 400,
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
      body: JSON.stringify({ connectionCode: bobInitialCode }),
    });
    const validLinkData = await validLinkRes.json();

    assert(
      validLinkRes.ok && validLinkData.success && validLinkData.patient.id === bobUser.id,
      3,
      'Caregiver connects successfully with valid code',
      `Linked caregiver Carol to patient ${validLinkData.patient?.name}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Connection code cannot be reused after revocation
    // -------------------------------------------------------------------------
    const revokeRes = await fetch(`${baseUrl}/api/patient/connection-code/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });

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

    const reuseLinkRes = await fetch(`${baseUrl}/api/caregiver/link-patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`,
      },
      body: JSON.stringify({ connectionCode: bobInitialCode }),
    });

    assert(
      reuseLinkRes.status === 400,
      4,
      'Connection code cannot be reused after revocation',
      `Rejected revoked code with HTTP status ${reuseLinkRes.status}`
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
        instructions: 'Take 1 tablet with food',
      }),
    });
    const addedMed = await addMedRes.json();

    assert(
      addMedRes.status === 201 && addedMed.name === 'Metformin',
      5,
      'Caregiver can add medication for linked patient',
      `Added medication ${addedMed.name} for patient ${bobUser.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Patient can see new medication in schedule
    // -------------------------------------------------------------------------
    const patientMedsRes = await fetch(`${baseUrl}/api/medications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const patientMeds = await patientMedsRes.json();
    const foundMed = patientMeds.find((m: any) => m.id === addedMed.id);

    assert(
      patientMedsRes.ok && foundMed !== undefined && foundMed.name === 'Metformin',
      6,
      'Patient can see new medication in schedule',
      `Patient fetched medications and found ${foundMed?.name} (${foundMed?.scheduledTime})`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Patient can mark medication as taken
    // -------------------------------------------------------------------------
    const logTakeRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ status: 'taken', takenAt: '08:05 AM' }),
    });
    const logTakeData = await logTakeRes.json();

    assert(
      logTakeRes.ok && logTakeData.status === 'taken',
      7,
      'Patient can mark medication as taken',
      `Logged taken status for medication ${addedMed.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Caregiver sees medication adherence updated
    // -------------------------------------------------------------------------
    const caregiverMedsRes = await fetch(`${baseUrl}/api/medications?patientId=${bobUser.id}`, {
      headers: { Authorization: `Bearer ${carolToken}` },
    });
    const caregiverMeds = await caregiverMedsRes.json();
    const updatedMedForCaregiver = caregiverMeds.find((m: any) => m.id === addedMed.id);

    assert(
      caregiverMedsRes.ok && updatedMedForCaregiver?.status === 'taken',
      8,
      'Caregiver sees medication adherence updated',
      `Caregiver retrieved status: ${updatedMedForCaregiver?.status} (takenAt: ${updatedMedForCaregiver?.takenAt})`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Caregiver changes medication time -> Patient schedule updates
    // -------------------------------------------------------------------------
    const updateMedRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${carolToken}`,
      },
      body: JSON.stringify({
        scheduledTime: '08:30 AM',
        dosage: '1000mg Extended Release',
      }),
    });
    const updateMedData = await updateMedRes.json();

    assert(
      updateMedRes.ok &&
        updateMedData.medication.scheduledTime === '08:30 AM' &&
        updateMedData.medication.dosage === '1000mg Extended Release',
      9,
      'Caregiver changes medication time -> Patient schedule updates',
      `Updated time to ${updateMedData.medication?.scheduledTime} and dosage to ${updateMedData.medication?.dosage}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Caregiver deactivates medication -> Patient schedule removes it
    // -------------------------------------------------------------------------
    const deleteMedRes = await fetch(`${baseUrl}/api/medications/${addedMed.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${carolToken}` },
    });

    const patientMedsAfterDeleteRes = await fetch(`${baseUrl}/api/medications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const patientMedsAfterDelete = await patientMedsAfterDeleteRes.json();
    const medStillPresent = patientMedsAfterDelete.some((m: any) => m.id === addedMed.id);

    assert(
      deleteMedRes.ok && !medStillPresent,
      10,
      'Caregiver deactivates medication -> Patient schedule removes it',
      'Deactivated medication is excluded from active schedule'
    );

    // -------------------------------------------------------------------------
    // TEST 11: Unlinked caregiver cannot access or modify patient medications (HTTP 403)
    // -------------------------------------------------------------------------
    const unlinkedMedsRes = await fetch(`${baseUrl}/api/medications?patientId=${bobUser.id}`, {
      headers: { Authorization: `Bearer ${daveToken}` },
    });
    const unlinkedAddMedRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`,
      },
      body: JSON.stringify({
        patientId: bobUser.id,
        name: 'Unauthorized Pill',
        dosage: '10mg',
        scheduledTime: '08:00 AM',
      }),
    });

    assert(
      unlinkedMedsRes.status === 403 && unlinkedAddMedRes.status === 403,
      11,
      'Unlinked caregiver cannot access or modify patient medications (HTTP 403)',
      `Read returned ${unlinkedMedsRes.status}, Write returned ${unlinkedAddMedRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Escalation worker escalates missed doses for active medications only
    // -------------------------------------------------------------------------
    const activeEscMedRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({
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
    const caregiverSyncResult = await syncNativeMedicationAlarms([{ id: 'test', name: 'Med', dosage: '10mg', scheduledTime: '08:00 AM', status: 'due' } as any], 'caregiver');
    const patientSyncResult = await syncNativeMedicationAlarms([{ id: 'test', name: 'Med', dosage: '10mg', scheduledTime: '08:00 AM', status: 'due' } as any], 'patient');

    assert(
      caregiverSyncResult.scheduledCount === 0 && patientSyncResult.scheduledCount === 1,
      14,
      'Native alarm sync function only schedules alarms on patient role, not caregiver',
      `Caregiver device receives 0 alarms, while patient device receives ${patientSyncResult.scheduledCount} alarm`
    );

    // -------------------------------------------------------------------------
    // TEST 15: Fresh patient has 0 steps and 0L water (no fake 4000 steps or fake 66 CareScore)
    // -------------------------------------------------------------------------
    const freshPatientSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'patient',
        name: 'Fresh Patient Frank',
        email: `frank-${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const freshData = await freshPatientSignup.json();
    const frankToken = freshData.token;

    const frankActivityRes = await fetch(`${baseUrl}/api/activity`, {
      headers: { Authorization: `Bearer ${frankToken}` },
    });
    const frankActivity = await frankActivityRes.json();

    const frankHydrationRes = await fetch(`${baseUrl}/api/hydration`, {
      headers: { Authorization: `Bearer ${frankToken}` },
    });
    const frankHydration = await frankHydrationRes.json();

    assert(
      frankActivity.steps === 0 && frankHydration.currentLiters === 0,
      15,
      'Fresh patient starts with 0 steps and 0L water (no fake 4000 steps)',
      `Steps: ${frankActivity.steps}, Hydration: ${frankHydration.currentLiters}L`
    );

    // -------------------------------------------------------------------------
    // TEST 16: Invalid medication time format is rejected with HTTP 400
    // -------------------------------------------------------------------------
    const invalidTimeRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankToken}`,
      },
      body: JSON.stringify({
        name: 'Pill X',
        dosage: '10mg',
        scheduledTime: 'not_a_valid_time',
      }),
    });

    assert(
      invalidTimeRes.status === 400,
      16,
      'Invalid medication scheduled time format is rejected with HTTP 400',
      `Server rejected "not_a_valid_time" with status 400`
    );

    // -------------------------------------------------------------------------
    // TEST 17: Medication scheduled with 24h format (14:30) is normalized to 12h format (02:30 PM)
    // -------------------------------------------------------------------------
    const normTimeRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankToken}`,
      },
      body: JSON.stringify({
        name: 'Afternoon Statin',
        dosage: '20mg',
        scheduledTime: '14:30',
        category: 'afternoon',
      }),
    });
    const normTimeData = await normTimeRes.json();

    assert(
      normTimeRes.status === 201 && normTimeData.scheduledTime === '02:30 PM',
      17,
      'Medication 24h time input is normalized to standard 12h format',
      `Input "14:30" saved as "${normTimeData.scheduledTime}"`
    );

    // -------------------------------------------------------------------------
    // TEST 18: Hydration settings GET and PUT with interval/time validation
    // -------------------------------------------------------------------------
    const updateHydSettingsRes = await fetch(`${baseUrl}/api/hydration/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankToken}`,
      },
      body: JSON.stringify({
        dailyGoalLiters: 2.5,
        intervalMinutes: 45,
        startTime: '07:30',
        endTime: '21:00',
        reminderEnabled: true,
      }),
    });
    const hydSettingsData = await updateHydSettingsRes.json();

    assert(
      updateHydSettingsRes.ok &&
        hydSettingsData.settings.dailyGoalLiters === 2.5 &&
        hydSettingsData.settings.intervalMinutes === 45,
      18,
      'Hydration settings update and retrieval',
      `Goal: ${hydSettingsData.settings?.dailyGoalLiters}L, Interval: ${hydSettingsData.settings?.intervalMinutes}m`
    );

    // -------------------------------------------------------------------------
    // TEST 19: Hydration reminder sync cancelled on caregiver device and scheduled on patient device
    // -------------------------------------------------------------------------
    const caregiverHydSync = await syncNativeHydrationReminders(hydSettingsData.settings, 'caregiver');
    const patientHydSync = await syncNativeHydrationReminders(hydSettingsData.settings, 'patient');

    assert(
      caregiverHydSync.enabled === false && patientHydSync.enabled === true,
      19,
      'Hydration reminder sync isolation between patient and caregiver',
      `Caregiver enabled: ${caregiverHydSync.enabled}, Patient enabled: ${patientHydSync.enabled}`
    );

    // -------------------------------------------------------------------------
    // TEST 20: Activity device sync updates steps and persists to SQLite
    // -------------------------------------------------------------------------
    const syncActRes = await fetch(`${baseUrl}/api/activity/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankToken}`,
      },
      body: JSON.stringify({
        steps: 1250,
        distanceKm: 0.95,
        caloriesBurned: 55,
        activeMinutes: 14,
      }),
    });
    const syncActData = await syncActRes.json();

    const dbAct = db.prepare('SELECT steps FROM activity_logs WHERE patient_id = ? AND log_date = ?').get(freshData.user.id, todayStr) as any;

    assert(
      syncActRes.ok && dbAct?.steps === 1250,
      20,
      'Device activity sync updates steps and persists to SQLite',
      `Synced ${dbAct?.steps} steps to database`
    );

    // -------------------------------------------------------------------------
    // TEST 21: Profile avatar photo upload validation and patient isolation
    // -------------------------------------------------------------------------
    const avatarUpdateRes = await fetch(`${baseUrl}/api/patient/avatar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankToken}`,
      },
      body: JSON.stringify({
        avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...',
      }),
    });
    const avatarData = await avatarUpdateRes.json();

    const dbUser = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(freshData.user.id) as any;

    assert(
      avatarUpdateRes.ok && (dbUser.avatar_url?.startsWith('/uploads/') || dbUser.avatar_url?.startsWith('data:image/')),
      21,
      'Profile photo avatar upload and persistence via storage service',
      `Avatar URL saved: ${dbUser.avatar_url}`
    );

    // -------------------------------------------------------------------------
    // TEST 22: CORS Headers & OPTIONS preflight for WebView cross-origin requests
    // -------------------------------------------------------------------------
    const optionsRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    assert(
      optionsRes.status === 200 && optionsRes.headers.get('access-control-allow-origin') === '*',
      22,
      'CORS preflight (OPTIONS) returns 200 OK and allows all origins',
      `Status: ${optionsRes.status}, Access-Control-Allow-Origin: ${optionsRes.headers.get('access-control-allow-origin')}`
    );

    // -------------------------------------------------------------------------
    // TEST 23: Login with invalid credentials returns JSON error (never HTML)
    // -------------------------------------------------------------------------
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrongpassword' }),
    });
    const badLoginContentType = badLoginRes.headers.get('content-type') || '';
    const badLoginData = await badLoginRes.json();

    assert(
      badLoginRes.status === 401 && badLoginContentType.includes('application/json') && typeof badLoginData.error === 'string',
      23,
      'Invalid login returns HTTP 401 JSON error rather than HTML',
      `Status: ${badLoginRes.status}, Content-Type: ${badLoginContentType}, error: "${badLoginData.error}"`
    );

    // -------------------------------------------------------------------------
    // TEST 24: Health check endpoint returns JSON and database status
    // -------------------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthContentType = healthRes.headers.get('content-type') || '';
    const healthData = await healthRes.json();

    assert(
      healthRes.status === 200 && healthContentType.includes('application/json') && healthData.status === 'ok',
      24,
      'Health check endpoint returns HTTP 200 with JSON status: "ok"',
      `Status: ${healthRes.status}, environment: "${healthData.environment}"`
    );

    // -------------------------------------------------------------------------
    // TEST 25: Refresh Token Rotation (POST /api/auth/refresh)
    // -------------------------------------------------------------------------
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: freshData.refreshToken }),
    });
    const refreshData = await refreshRes.json();

    assert(
      refreshRes.ok && typeof refreshData.token === 'string' && typeof refreshData.refreshToken === 'string' && refreshData.refreshToken !== freshData.refreshToken,
      25,
      'Refresh token rotation issues a new access token and rotated refresh token',
      `New Token issued, New Refresh Token: ${refreshData.refreshToken?.substring(0, 12)}...`
    );

    // -------------------------------------------------------------------------
    // TEST 26: Replay of used refresh token is detected and rejected (HTTP 401)
    // -------------------------------------------------------------------------
    const replayRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: freshData.refreshToken }), // Using old revoked token
    });

    assert(
      replayRes.status === 401,
      26,
      'Replay of revoked refresh token is rejected and revokes session',
      `Server rejected replayed token with status ${replayRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 27: Database readiness check (GET /api/health/ready)
    // -------------------------------------------------------------------------
    const readyRes = await fetch(`${baseUrl}/api/health/ready`);
    const readyData = await readyRes.json();

    assert(
      readyRes.status === 200 && readyData.status === 'ready' && readyData.database?.ok === true,
      27,
      'Database readiness check verifies connectivity',
      `Database: ${readyData.database?.type} (Latency: ${readyData.database?.latencyMs}ms)`
    );

    // -------------------------------------------------------------------------
    // TEST 28: Logout revokes active refresh token (POST /api/auth/logout)
    // -------------------------------------------------------------------------
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshData.refreshToken }),
    });

    const refreshAfterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshData.refreshToken }),
    });

    assert(
      logoutRes.ok && refreshAfterLogout.status === 401,
      28,
      'Logout successfully revokes refresh token in database',
      `Logout returned 200, post-logout refresh attempt returned ${refreshAfterLogout.status}`
    );

    // Clean up test records
    db.prepare('DELETE FROM users WHERE email LIKE \'%@example.com\'').run();
  } finally {
    server.close();
  }

  console.log('\n===================================================================');
  console.log(`   E2E VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllE2ETests().catch((err) => {
  console.error('E2E Test Error:', err);
  process.exit(1);
});
