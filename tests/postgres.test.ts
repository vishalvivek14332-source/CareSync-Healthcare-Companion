import express from 'express';
import http from 'http';
import { initDb, checkDatabaseHealth, queryRow, queryRows, executeSql } from '../server/db';
import { generateAccessToken, generateRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../server/auth';
import { createConnectionCodeForPatient, redeemConnectionCode } from '../server/services/connectionCodeService';
import { NotificationService } from '../server/services/notificationService';
import { authRouter } from '../server/routes/authRoutes';

async function testPostgresCompatibility() {
  console.log('===================================================================');
  console.log('   CareSync Database Abstraction Layer & PostgreSQL Verification');
  console.log('===================================================================\n');

  await initDb();

  const health = await checkDatabaseHealth();
  console.log(`[Database Health Check]: ok=${health.ok}, type=${health.type}, latency=${health.latencyMs}ms`);

  // Start temporary Express server to test real HTTP POST /api/auth/signup endpoint
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Test 1: Real HTTP POST /api/auth/signup Regression Verification
    const signupEmail = `signup-test-${Date.now()}@example.com`;
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: signupEmail,
        password: 'Password123!',
        role: 'patient',
        name: 'Sarah Test Patient',
        age: 70,
        phone: '+15559876543',
      }),
    });

    const signupData: any = await signupRes.json();
    if (signupRes.status !== 201 || !signupData.token || !signupData.user) {
      throw new Error(`Signup failed with status ${signupRes.status}: ${JSON.stringify(signupData)}`);
    }
    console.log('✅ PASS: Real HTTP POST /api/auth/signup creates user via db abstraction with status 201');

    // Test 2: Real HTTP POST /api/auth/login Regression Verification
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: signupEmail,
        password: 'Password123!',
      }),
    });

    const loginData: any = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token || !loginData.user) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginData)}`);
    }
    console.log('✅ PASS: Real HTTP POST /api/auth/login authenticates user with status 200');

    // Test 3: Connection Code Generation & Redemption via Abstraction
    const patientId = signupData.user.id;
    const codeInfo = await createConnectionCodeForPatient(patientId);
    console.log(`✅ PASS: Generated connection code: ${codeInfo.code}`);

    const caregiverId = `c-pgtest-${Date.now()}`;
    await executeSql(`
      INSERT INTO users (id, email, password_hash, role, name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      caregiverId,
      `cg-${Date.now()}@example.com`,
      'hashedpass123',
      'caregiver',
      'Postgres Test Caregiver',
      new Date().toISOString(),
    ]);

    const redeemResult = await redeemConnectionCode(caregiverId, codeInfo.code);
    if (!redeemResult.success) {
      throw new Error(`Connection code redemption failed: ${redeemResult.error}`);
    }
    console.log('✅ PASS: Connection code redeemed and caregiver linked to patient');

    // Test 4: Refresh Token Rotation & Revocation
    const { refreshToken } = await generateRefreshToken(patientId, 'Postgres Test Runner');
    const rotResult = await rotateRefreshToken(refreshToken, 'Postgres Test Runner');
    if (!rotResult.success || !rotResult.newRefreshToken) {
      throw new Error(`Refresh token rotation failed: ${rotResult.error}`);
    }
    console.log('✅ PASS: Refresh token generated and rotated successfully');

    const revoked = await revokeRefreshToken(rotResult.newRefreshToken);
    if (!revoked) {
      throw new Error('Refresh token revocation failed');
    }
    console.log('✅ PASS: Refresh token revoked successfully');

    // Test 5: Medication CRUD & Dose Logging
    const medId = `med-pg-${Date.now()}`;
    await executeSql(`
      INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [medId, patientId, 'Lisinopril', '20mg', '08:00 AM', 'Take with water', 'morning', 'bg-teal-50 text-teal-700', new Date().toISOString()]);

    const medList = await queryRows<any>('SELECT * FROM medications WHERE patient_id = ?', [patientId]);
    if (medList.length === 0) {
      throw new Error('Medication insertion failed');
    }
    console.log('✅ PASS: Medication created and queried');

    // Test 6: Notification Service & Alerts
    await NotificationService.notifyPatient(patientId, 'Test Reminder', 'Time for medication');
    const notifs = await queryRows<any>('SELECT * FROM notifications WHERE patient_id = ?', [patientId]);
    if (notifs.length === 0) {
      throw new Error('Notification creation failed');
    }
    console.log('✅ PASS: NotificationService correctly records notifications');

    console.log('\n===================================================================');
    console.log('   ALL POSTGRESQL ABSTRACTION & HTTP ENDPOINT TESTS PASSED');
    console.log('===================================================================\n');
  } finally {
    server.close();
  }
}

testPostgresCompatibility().catch((err) => {
  console.error('❌ Postgres test error:', err);
  process.exit(1);
});
