import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { runPostgresMigrations } from '../server/db';

dotenv.config();

async function migrateSqliteToPostgres() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ [Migration Error] DATABASE_URL environment variable is required to run the PostgreSQL migration.');
    console.error('   Example: DATABASE_URL=postgresql://user:pass@localhost:5432/caresync');
    process.exit(1);
  }

  const sqlitePath = path.join(process.cwd(), 'caresync.db');
  console.log('======================================================================');
  console.log('   CareSync SQLite -> PostgreSQL Production Data Migration Tool');
  console.log('======================================================================\n');
  console.log(`📖 Source SQLite Database: ${sqlitePath}`);
  console.log(`🐘 Target PostgreSQL DB  : ${databaseUrl.replace(/:[^:@]*@/, ':****@')}\n`);

  const sqlite = new Database(sqlitePath);
  const pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pgPool.connect();

  try {
    console.log('⚙️  Step 1: Initializing PostgreSQL Schema Migrations...');
    await runPostgresMigrations(client);
    console.log('✅ PostgreSQL Schema is ready.\n');

    console.log('🚀 Step 2: Starting Transactional Data Migration...');
    await client.query('BEGIN');

    const summary: Record<string, number> = {};

    // 1. Users
    const users = sqlite.prepare('SELECT * FROM users').all() as any[];
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, name, age, phone, avatar_url, timezone, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url`,
        [u.id, u.email, u.password_hash, u.role, u.name, u.age, u.phone, u.avatar_url, u.timezone || 'UTC', u.primary_caregiver, u.caregiver_phone, u.emergency_contact, u.emergency_phone, u.quiet_hours, u.created_at]
      );
    }
    summary['users'] = users.length;

    // 2. Caregiver Patient Links
    const links = sqlite.prepare('SELECT * FROM caregiver_patient_links').all() as any[];
    for (const l of links) {
      await client.query(
        `INSERT INTO caregiver_patient_links (id, caregiver_id, patient_id, link_code, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (caregiver_id, patient_id) DO NOTHING`,
        [l.id, l.caregiver_id, l.patient_id, l.link_code, l.created_at]
      );
    }
    summary['caregiver_patient_links'] = links.length;

    // 3. Medications
    const meds = sqlite.prepare('SELECT * FROM medications').all() as any[];
    for (const m of meds) {
      await client.query(
        `INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, timezone, instructions, category, color, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.patient_id, m.name, m.dosage, m.scheduled_time, m.timezone || 'UTC', m.instructions, m.category, m.color, m.active, m.created_at]
      );
    }
    summary['medications'] = meds.length;

    // 4. Medication Logs
    const medLogs = sqlite.prepare('SELECT * FROM medication_logs').all() as any[];
    for (const ml of medLogs) {
      await client.query(
        `INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [ml.id, ml.medication_id, ml.patient_id, ml.status, ml.scheduled_date, ml.taken_at, ml.created_at]
      );
    }
    summary['medication_logs'] = medLogs.length;

    // 5. Hydration Settings
    const hydSettings = sqlite.prepare('SELECT * FROM hydration_settings').all() as any[];
    for (const hs of hydSettings) {
      await client.query(
        `INSERT INTO hydration_settings (id, patient_id, daily_goal_liters, reminder_enabled, start_time, end_time, interval_minutes, timezone, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (patient_id) DO NOTHING`,
        [hs.id, hs.patient_id, hs.daily_goal_liters, hs.reminder_enabled, hs.start_time, hs.end_time, hs.interval_minutes, hs.timezone || 'UTC', hs.updated_at]
      );
    }
    summary['hydration_settings'] = hydSettings.length;

    // 6. Hydration Logs
    const hydLogs = sqlite.prepare('SELECT * FROM hydration_logs').all() as any[];
    for (const hl of hydLogs) {
      await client.query(
        `INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [hl.id, hl.patient_id, hl.amount_ml, hl.timestamp, hl.logged_at]
      );
    }
    summary['hydration_logs'] = hydLogs.length;

    // 7. Activity Logs
    const actLogs = sqlite.prepare('SELECT * FROM activity_logs').all() as any[];
    for (const al of actLogs) {
      await client.query(
        `INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (patient_id, log_date) DO NOTHING`,
        [al.id, al.patient_id, al.steps, al.step_goal, al.active_minutes, al.active_minutes_goal, al.calories_burned, al.distance_km, al.log_date, al.source || 'manual']
      );
    }
    summary['activity_logs'] = actLogs.length;

    // 8. Alerts
    const alerts = sqlite.prepare('SELECT * FROM alerts').all() as any[];
    for (const a of alerts) {
      await client.query(
        `INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.patient_id, a.patient_name, a.type, a.severity, a.title, a.description, a.reviewed, a.action_text, a.timestamp, a.created_at]
      );
    }
    summary['alerts'] = alerts.length;

    // 9. Escalation Rules
    const escRules = sqlite.prepare('SELECT * FROM escalation_rules').all() as any[];
    for (const er of escRules) {
      await client.query(
        `INSERT INTO escalation_rules (id, patient_id, caregiver_name, caregiver_phone, caregiver_email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, quiet_hours_start, quiet_hours_end, max_reminders_before_escalation, repeat_reminder_interval_minutes, levels_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (patient_id) DO NOTHING`,
        [er.id, er.patient_id, er.caregiver_name, er.caregiver_phone, er.caregiver_email, er.emergency_contact_name, er.emergency_contact_phone, er.emergency_contact_relation, er.quiet_hours_start, er.quiet_hours_end, er.max_reminders_before_escalation, er.repeat_reminder_interval_minutes, er.levels_json, er.updated_at]
      );
    }
    summary['escalation_rules'] = escRules.length;

    // 10. Care Connection Codes
    const codes = sqlite.prepare('SELECT * FROM care_connection_codes').all() as any[];
    for (const c of codes) {
      await client.query(
        `INSERT INTO care_connection_codes (id, patient_id, code_hash, code_display, expires_at, used_at, revoked_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code_hash) DO NOTHING`,
        [c.id, c.patient_id, c.code_hash, c.code_display, c.expires_at, c.used_at, c.revoked_at, c.created_at]
      );
    }
    summary['care_connection_codes'] = codes.length;

    await client.query('COMMIT');
    console.log('✨ Data migration transaction committed successfully!\n');

    console.log('📊 MIGRATION SUMMARY:');
    console.log('--------------------------------------------------');
    for (const [table, count] of Object.entries(summary)) {
      console.log(`   - ${table.padEnd(28)} : ${count} records migrated`);
    }
    console.log('--------------------------------------------------\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed with error. Transaction rolled back completely.');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    sqlite.close();
    await pgPool.end();
  }
}

migrateSqliteToPostgres().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
