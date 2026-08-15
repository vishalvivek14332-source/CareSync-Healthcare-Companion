import express from 'express';
import http from 'http';
import { initDb, queryRow, queryRows, executeSql } from '../server/db';
import { authRouter } from '../server/routes/authRoutes';
import { hydrationRouter } from '../server/routes/hydrationRoutes';
import { medicationRouter, isMedicationActiveOnDate } from '../server/routes/medicationRoutes';
import { authenticateToken, generateAccessToken, generateRefreshToken } from '../server/auth';

async function runSchedulingTests() {
  console.log('===================================================================');
  console.log('   CareSync Scheduling, Recurrence & Auth Persistence Test Suite   ');
  console.log('===================================================================\n');

  await initDb();

  // Spin up an isolated test Express server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/hydration', authenticateToken, hydrationRouter);
  app.use('/api/medications', authenticateToken, medicationRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Auth Session Creation & Setup
    // -------------------------------------------------------------------------
    const patientEmail = `sched_patient_${Date.now()}@example.com`;
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password: 'Password123!',
        name: 'Scheduling Test Patient',
        role: 'patient',
      }),
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 201 && signupData.token && signupData.refreshToken, 'Test 1: Patient signup returns tokens');
    const patientToken = signupData.token;
    const patientRefreshToken = signupData.refreshToken;
    const patientId = signupData.user.id;

    // -------------------------------------------------------------------------
    // TEST 2: Auth Session Restoration via /api/auth/me
    // -------------------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user.email === patientEmail, 'Test 2: Auth session restored successfully via /api/auth/me');

    // -------------------------------------------------------------------------
    // TEST 3: Expired Access Token + Refresh Token Rotation
    // -------------------------------------------------------------------------
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: patientRefreshToken }),
    });
    const refreshData = await refreshRes.json();
    assert(refreshRes.status === 200 && refreshData.token && refreshData.refreshToken !== patientRefreshToken, 'Test 3: Refresh token rotated successfully');
    const newAccessToken = refreshData.token;

    // -------------------------------------------------------------------------
    // TEST 4: Hydration Schedule Creation (Single & Multiple Slots)
    // -------------------------------------------------------------------------
    const slot1Res = await fetch(`${baseUrl}/api/hydration/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        scheduledTime: '08:00 AM',
        amountMl: 250,
        repeatDays: 'daily',
        enabled: true,
      }),
    });
    const slot1 = await slot1Res.json();
    assert(slot1Res.status === 201 && slot1.amountMl === 250, 'Test 4: Hydration schedule slot 1 created (08:00 AM, 250ml)');

    const slot2Res = await fetch(`${baseUrl}/api/hydration/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        scheduledTime: '12:00 PM',
        amountMl: 300,
        repeatDays: 'weekdays',
        enabled: true,
      }),
    });
    const slot2 = await slot2Res.json();
    assert(slot2Res.status === 201 && slot2.amountMl === 300, 'Test 5: Hydration schedule slot 2 created (12:00 PM, 300ml)');

    // -------------------------------------------------------------------------
    // TEST 6: Fetch All Hydration Schedules
    // -------------------------------------------------------------------------
    const listSchedulesRes = await fetch(`${baseUrl}/api/hydration/schedules`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    const schedulesList = await listSchedulesRes.json();
    assert(Array.isArray(schedulesList) && schedulesList.length === 2, 'Test 6: Multiple hydration slots queried successfully');

    // -------------------------------------------------------------------------
    // TEST 7: Hydration Schedule Update (Modify & Toggle Enabled)
    // -------------------------------------------------------------------------
    const updateSlotRes = await fetch(`${baseUrl}/api/hydration/schedules/${slot1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        amountMl: 350,
        enabled: false,
      }),
    });
    const updatedSlot = await updateSlotRes.json();
    assert(updateSlotRes.status === 200 && updatedSlot.amountMl === 350 && updatedSlot.enabled === false, 'Test 7: Hydration schedule updated and toggled');

    // -------------------------------------------------------------------------
    // TEST 8: Hydration Schedule Deletion
    // -------------------------------------------------------------------------
    const deleteSlotRes = await fetch(`${baseUrl}/api/hydration/schedules/${slot2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert(deleteSlotRes.status === 200, 'Test 8: Hydration schedule slot deleted');

    // -------------------------------------------------------------------------
    // TEST 9: Daily Medication Creation & Recurrence
    // -------------------------------------------------------------------------
    const medDailyRes = await fetch(`${baseUrl}/api/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Atorvastatin Daily',
        dosage: '20 mg',
        scheduledTime: '08:00 AM',
        category: 'morning',
        repeatPattern: 'daily',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }),
    });
    const medDaily = await medDailyRes.json();
    assert(medDailyRes.status === 201 && medDaily.repeatPattern === 'daily', 'Test 9: Daily medication created with start and end dates');

    // -------------------------------------------------------------------------
    // TEST 10: Weekday Recurrence Calculation (Monday vs Sunday)
    // -------------------------------------------------------------------------
    const medWeekday = {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      repeatPattern: 'weekdays',
      daysOfWeek: null,
    };
    // 2026-09-02 is Wednesday (Weekday -> Active)
    // 2026-09-06 is Sunday (Weekend -> Inactive)
    const isWedActive = isMedicationActiveOnDate(medWeekday, '2026-09-02');
    const isSunActive = isMedicationActiveOnDate(medWeekday, '2026-09-06');
    assert(isWedActive === true && isSunActive === false, 'Test 10: Weekday recurrence rule correctly includes Wednesday and excludes Sunday');

    // -------------------------------------------------------------------------
    // TEST 11: Weekend Recurrence Calculation (Saturday vs Tuesday)
    // -------------------------------------------------------------------------
    const medWeekend = {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      repeatPattern: 'weekends',
      daysOfWeek: null,
    };
    // 2026-09-05 is Saturday (Weekend -> Active)
    // 2026-09-08 is Tuesday (Weekday -> Inactive)
    const isSatActive = isMedicationActiveOnDate(medWeekend, '2026-09-05');
    const isTueActive = isMedicationActiveOnDate(medWeekend, '2026-09-08');
    assert(isSatActive === true && isTueActive === false, 'Test 11: Weekend recurrence rule correctly includes Saturday and excludes Tuesday');

    // -------------------------------------------------------------------------
    // TEST 12: Custom Days Recurrence Calculation (Mon, Wed, Fri)
    // -------------------------------------------------------------------------
    const medCustom = {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      repeatPattern: 'custom',
      daysOfWeek: '["Mon", "Wed", "Fri"]',
    };
    // 2026-09-04 is Friday -> Active
    // 2026-09-03 is Thursday -> Inactive
    const isFriActive = isMedicationActiveOnDate(medCustom, '2026-09-04');
    const isThuActive = isMedicationActiveOnDate(medCustom, '2026-09-03');
    assert(isFriActive === true && isThuActive === false, 'Test 12: Custom-day recurrence correctly evaluates Mon/Wed/Fri');

    // -------------------------------------------------------------------------
    // TEST 13: Month Range Boundary Calculation (Before Start & After End Date)
    // -------------------------------------------------------------------------
    const isBeforeStart = isMedicationActiveOnDate(medDaily, '2026-08-31');
    const isInsideRange = isMedicationActiveOnDate(medDaily, '2026-09-15');
    const isAfterEnd = isMedicationActiveOnDate(medDaily, '2026-10-01');
    assert(isBeforeStart === false && isInsideRange === true && isAfterEnd === false, 'Test 13: Date range boundaries strictly enforced');

    // -------------------------------------------------------------------------
    // TEST 14: Date-Filtered Medications API (GET /api/medications?date=YYYY-MM-DD)
    // -------------------------------------------------------------------------
    const medsOnDateRes = await fetch(`${baseUrl}/api/medications?date=2026-09-15`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    const medsOnDate = await medsOnDateRes.json();
    assert(Array.isArray(medsOnDate) && medsOnDate.some((m) => m.id === medDaily.id), 'Test 14: GET /api/medications?date returns active recurring medications for date');

    // -------------------------------------------------------------------------
    // TEST 15: IDOR & Authorization Protection for Hydration Schedules
    // -------------------------------------------------------------------------
    const otherEmail = `other_patient_${Date.now()}@example.com`;
    const otherRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otherEmail, password: 'Password123!', name: 'Other User', role: 'patient' }),
    });
    const otherData = await otherRes.json();
    const otherToken = otherData.token;

    const crossAccessRes = await fetch(`${baseUrl}/api/hydration/schedules/${slot1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify({ amountMl: 999 }),
    });
    assert(crossAccessRes.status === 403, 'Test 15: IDOR Protected - Unlinked user cannot modify another patient hydration schedule');

    // -------------------------------------------------------------------------
    // TEST 16: Log Medication Dose for Specific Date
    // -------------------------------------------------------------------------
    const logDoseRes = await fetch(`${baseUrl}/api/medications/${medDaily.id}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: JSON.stringify({
        status: 'taken',
        scheduledDate: '2026-09-15',
        takenAt: '08:05 AM',
      }),
    });
    const logDoseData = await logDoseRes.json();
    assert(logDoseRes.status === 200 && logDoseData.status === 'taken', 'Test 16: Dose logged for specific calendar date');

  } catch (err: any) {
    console.error('❌ Test execution error:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n===================================================================');
    console.log(`   SCHEDULING & PERSISTENCE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('===================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runSchedulingTests();
