import Database from 'better-sqlite3';
import { Pool, PoolClient } from 'pg';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from './config';

// -----------------------------------------------------------------------------
// POSTGRESQL POOL SETUP (Production & Cloud Staging)
// -----------------------------------------------------------------------------
export let pgPool: Pool | null = null;
if (config.databaseUrl) {
  const isSslRequired =
    config.isProduction ||
    config.databaseUrl.includes('sslmode=require') ||
    config.databaseUrl.includes('neon.tech');

  pgPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on('error', (err) => {
    console.error('❌ Unexpected PostgreSQL client error on idle pool:', err);
  });
}

// -----------------------------------------------------------------------------
// SQLITE FALLBACK SETUP (Local Isolated Dev & Automated Unit Tests)
// -----------------------------------------------------------------------------
const dbPath = path.join(process.cwd(), 'caresync.db');
export const sqliteDb = new Database(dbPath);
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

// Export db symbol for backward compatibility in existing synchronous calls
export const db = sqliteDb;

// -----------------------------------------------------------------------------
// UNIFIED DATABASE QUERY INTERFACE
// -----------------------------------------------------------------------------
export async function queryRows<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (pgPool) {
    // Convert ? parameter placeholders to $1, $2 for PostgreSQL
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const result = await pgPool.query(pgSql, params);
    return result.rows as T[];
  } else {
    if (config.isProduction) {
      throw new Error('❌ Fatal: PostgreSQL database is required in production environment.');
    }
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...params) as T[];
  }
}

export async function queryRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function executeSql(sql: string, params: any[] = []): Promise<{ changes: number }> {
  if (pgPool) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const result = await pgPool.query(pgSql, params);
    return { changes: result.rowCount || 0 };
  } else {
    if (config.isProduction) {
      throw new Error('❌ Fatal: PostgreSQL database is required in production environment.');
    }
    const stmt = sqliteDb.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes };
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; type: string; latencyMs: number }> {
  const start = Date.now();
  try {
    if (pgPool) {
      await pgPool.query('SELECT 1 as health_check');
      return { ok: true, type: 'PostgreSQL', latencyMs: Date.now() - start };
    } else {
      sqliteDb.prepare('SELECT 1').get();
      return { ok: true, type: 'SQLite (Dev/Test)', latencyMs: Date.now() - start };
    }
  } catch (err: any) {
    console.error('❌ [Database Health Check Failed]:', err?.message);
    return { ok: false, type: pgPool ? 'PostgreSQL' : 'SQLite', latencyMs: Date.now() - start };
  }
}

// -----------------------------------------------------------------------------
// POSTGRESQL DDL MIGRATIONS
// -----------------------------------------------------------------------------
export async function runPostgresMigrations(client: PoolClient | Pool) {
  await client.query(`
    -- USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL CHECK(role IN ('patient', 'caregiver')),
      name VARCHAR(255) NOT NULL,
      age INTEGER,
      phone VARCHAR(64),
      avatar_url TEXT,
      timezone VARCHAR(64) DEFAULT 'UTC',
      primary_caregiver VARCHAR(255),
      caregiver_phone VARCHAR(64),
      emergency_contact VARCHAR(255),
      emergency_phone VARCHAR(64),
      quiet_hours VARCHAR(64) DEFAULT '10:00 PM - 7:00 AM',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- REFRESH TOKENS TABLE (For 15m Access Token + 30d Refresh Token Rotation)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      device_info VARCHAR(255),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    -- CAREGIVER PATIENT LINKS
    CREATE TABLE IF NOT EXISTS caregiver_patient_links (
      id VARCHAR(64) PRIMARY KEY,
      caregiver_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      link_code VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(caregiver_id, patient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_links_caregiver ON caregiver_patient_links(caregiver_id);
    CREATE INDEX IF NOT EXISTS idx_links_patient ON caregiver_patient_links(patient_id);

    -- MEDICATIONS TABLE
    CREATE TABLE IF NOT EXISTS medications (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      dosage VARCHAR(255) NOT NULL,
      scheduled_time VARCHAR(32) NOT NULL,
      timezone VARCHAR(64) DEFAULT 'UTC',
      instructions TEXT NOT NULL DEFAULT '',
      category VARCHAR(32) NOT NULL CHECK(category IN ('morning', 'afternoon', 'evening')),
      color VARCHAR(128) NOT NULL DEFAULT 'bg-teal-50 text-teal-700 border-teal-200',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id, active);

    -- MEDICATION DOSE LOGS
    CREATE TABLE IF NOT EXISTS medication_logs (
      id VARCHAR(64) PRIMARY KEY,
      medication_id VARCHAR(64) NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL CHECK(status IN ('taken', 'due', 'missed', 'upcoming', 'snoozed')),
      scheduled_date VARCHAR(32) NOT NULL,
      taken_at VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_med_logs_patient_date ON medication_logs(patient_id, scheduled_date);

    -- HYDRATION LOGS
    CREATE TABLE IF NOT EXISTS hydration_logs (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_ml INTEGER NOT NULL CHECK(amount_ml > 0),
      timestamp VARCHAR(64) NOT NULL,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hydration_patient_date ON hydration_logs(patient_id, logged_at);

    -- HYDRATION SETTINGS
    CREATE TABLE IF NOT EXISTS hydration_settings (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      daily_goal_liters NUMERIC(4,2) NOT NULL DEFAULT 2.0,
      reminder_enabled INTEGER NOT NULL DEFAULT 1,
      start_time VARCHAR(16) NOT NULL DEFAULT '08:00',
      end_time VARCHAR(16) NOT NULL DEFAULT '20:00',
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      timezone VARCHAR(64) DEFAULT 'UTC',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ACTIVITY LOGS
    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      steps INTEGER NOT NULL DEFAULT 0,
      step_goal INTEGER NOT NULL DEFAULT 5000,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      active_minutes_goal INTEGER NOT NULL DEFAULT 30,
      calories_burned INTEGER NOT NULL DEFAULT 0,
      distance_km NUMERIC(5,2) NOT NULL DEFAULT 0.0,
      log_date VARCHAR(32) NOT NULL,
      source VARCHAR(64) DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(patient_id, log_date)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_patient_date ON activity_logs(patient_id, log_date);

    -- ROUTINE ITEMS
    CREATE TABLE IF NOT EXISTS routine_items (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      time VARCHAR(32) NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(32) NOT NULL CHECK(category IN ('medication', 'hydration', 'activity', 'wellness')),
      icon_name VARCHAR(64) NOT NULL DEFAULT 'CheckCircle2',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ALERTS TABLE
    CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_name VARCHAR(255) NOT NULL,
      type VARCHAR(64) NOT NULL,
      severity VARCHAR(32) NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'emergency')),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      reviewed INTEGER NOT NULL DEFAULT 0,
      action_text VARCHAR(255),
      timestamp VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id, reviewed);

    -- ESCALATION RULES
    CREATE TABLE IF NOT EXISTS escalation_rules (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caregiver_name VARCHAR(255),
      caregiver_phone VARCHAR(64),
      caregiver_email VARCHAR(255),
      emergency_contact_name VARCHAR(255),
      emergency_contact_phone VARCHAR(64),
      emergency_contact_relation VARCHAR(255),
      quiet_hours_start VARCHAR(16) DEFAULT '22:00',
      quiet_hours_end VARCHAR(16) DEFAULT '07:00',
      max_reminders_before_escalation INTEGER DEFAULT 3,
      repeat_reminder_interval_minutes INTEGER DEFAULT 15,
      levels_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- NOTIFICATIONS TABLE
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      type VARCHAR(32) NOT NULL CHECK(type IN ('reminder', 'alert', 'system', 'caregiver', 'emergency')),
      read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, read);

    -- MEDICATION ESCALATION STATES (With row-level locking for worker instances)
    CREATE TABLE IF NOT EXISTS medication_escalation_states (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medication_id VARCHAR(64) NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      scheduled_date VARCHAR(32) NOT NULL,
      scheduled_time VARCHAR(32) NOT NULL,
      current_level INTEGER NOT NULL DEFAULT 0,
      last_escalated_at TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL CHECK(status IN ('active', 'resolved', 'paused_quiet_hours')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(patient_id, medication_id, scheduled_date)
    );
    CREATE INDEX IF NOT EXISTS idx_esc_states_status ON medication_escalation_states(status);

    -- CARE CONNECTION CODES (Hashed storage for CARE-XXXXXX codes)
    CREATE TABLE IF NOT EXISTS care_connection_codes (
      id VARCHAR(64) PRIMARY KEY,
      patient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash VARCHAR(255) UNIQUE NOT NULL,
      code_display VARCHAR(64) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_connection_code_hash ON care_connection_codes(code_hash);

    -- DEVICE PUSH TOKENS (For multi-device FCM push notifications)
    CREATE TABLE IF NOT EXISTS device_push_tokens (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      platform VARCHAR(32) NOT NULL DEFAULT 'android',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_push_tokens(user_id);
  `);
}

// -----------------------------------------------------------------------------
// INITIALIZE DATABASE SCHEMA & SEED LOGIC
// -----------------------------------------------------------------------------
export async function initDb() {
  if (pgPool) {
    console.log('📦 [Database] Initializing PostgreSQL schema migrations...');
    await runPostgresMigrations(pgPool);
    console.log('✅ [Database] PostgreSQL schema initialized successfully.');
    return;
  }

  if (config.isProduction) {
    console.error('❌ [Database] Cannot start in production without DATABASE_URL configured for PostgreSQL.');
    process.exit(1);
  }

  // SQLite Schema Initialization for dev/testing
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('patient', 'caregiver')),
      name TEXT NOT NULL,
      age INTEGER,
      phone TEXT,
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      primary_caregiver TEXT,
      caregiver_phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      quiet_hours TEXT DEFAULT '10:00 PM - 7:00 AM',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      device_info TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS caregiver_patient_links (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      link_code TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(caregiver_id, patient_id)
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      instructions TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('morning', 'afternoon', 'evening')),
      color TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('taken', 'due', 'missed', 'upcoming', 'snoozed')),
      scheduled_date TEXT NOT NULL,
      taken_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hydration_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      amount_ml INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hydration_settings (
      id TEXT PRIMARY KEY,
      patient_id TEXT UNIQUE NOT NULL,
      daily_goal_liters REAL NOT NULL DEFAULT 2.0,
      reminder_enabled INTEGER NOT NULL DEFAULT 1,
      start_time TEXT NOT NULL DEFAULT '08:00',
      end_time TEXT NOT NULL DEFAULT '20:00',
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      timezone TEXT DEFAULT 'UTC',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      steps INTEGER NOT NULL DEFAULT 0,
      step_goal INTEGER NOT NULL DEFAULT 5000,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      active_minutes_goal INTEGER NOT NULL DEFAULT 30,
      calories_burned INTEGER NOT NULL DEFAULT 0,
      distance_km REAL NOT NULL DEFAULT 0.0,
      log_date TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(patient_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS routine_items (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      time TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      category TEXT NOT NULL CHECK(category IN ('medication', 'hydration', 'activity', 'wellness')),
      icon_name TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'emergency')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reviewed INTEGER DEFAULT 0,
      action_text TEXT,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS escalation_rules (
      id TEXT PRIMARY KEY,
      patient_id TEXT UNIQUE NOT NULL,
      caregiver_name TEXT,
      caregiver_phone TEXT,
      caregiver_email TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      quiet_hours_start TEXT DEFAULT '22:00',
      quiet_hours_end TEXT DEFAULT '07:00',
      max_reminders_before_escalation INTEGER DEFAULT 3,
      repeat_reminder_interval_minutes INTEGER DEFAULT 15,
      levels_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('reminder', 'alert', 'system', 'caregiver', 'emergency')),
      read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medication_escalation_states (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      medication_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      current_level INTEGER DEFAULT 0,
      last_escalated_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'resolved', 'paused_quiet_hours')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      UNIQUE(patient_id, medication_id, scheduled_date)
    );

    CREATE TABLE IF NOT EXISTS care_connection_codes (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      code_hash TEXT UNIQUE NOT NULL,
      code_display TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_push_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL DEFAULT 'android',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Auto-migrate SQLite missing columns if db existed before
  try { sqliteDb.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'"); } catch (e) {}
  try { sqliteDb.exec("ALTER TABLE medications ADD COLUMN timezone TEXT DEFAULT 'UTC'"); } catch (e) {}
  try { sqliteDb.exec("ALTER TABLE hydration_settings ADD COLUMN timezone TEXT DEFAULT 'UTC'"); } catch (e) {}

  seedDefaultDemoDataIfEmpty();
}

function seedDefaultDemoDataIfEmpty() {
  const userCount = (sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) return;

  const passwordHash = bcrypt.hashSync('password123', 10);
  const now = new Date().toISOString();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Seed Demo Patient Alex
  sqliteDb.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, age, phone, avatar_url, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p-1',
    'alex@caresync.com',
    passwordHash,
    'patient',
    'Alex Johnson',
    72,
    '(555) 012-3456',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    'Sarah Johnson',
    '(555) 019-2831',
    'Sarah Johnson (Daughter)',
    '(555) 019-2831',
    '10:00 PM - 7:00 AM',
    now
  );

  // 2. Seed Demo Caregiver Sarah
  sqliteDb.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'c-1',
    'sarah@caresync.com',
    passwordHash,
    'caregiver',
    'Sarah Johnson',
    '(555) 019-2831',
    now
  );

  // 3. Link Demo Users
  sqliteDb.prepare(`
    INSERT INTO caregiver_patient_links (id, caregiver_id, patient_id, link_code, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('link-1', 'c-1', 'p-1', 'ALEX72', now);

  // 4. Seed Demo Medications
  const insertMed = sqliteDb.prepare(`
    INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  insertMed.run('med-1', 'p-1', 'Morning Medication', 'Vitamin D3 (2,000 IU) + Lisinopril 10mg', '08:00 AM', 'Take with full glass of water after breakfast', 'morning', 'bg-emerald-50 text-emerald-700 border-emerald-200', now);
  insertMed.run('med-2', 'p-1', 'Afternoon Medication', 'Calcium Citrate 500mg', '01:00 PM', 'Take 1 tablet with light snack', 'afternoon', 'bg-amber-50 text-amber-800 border-amber-200', now);
  insertMed.run('med-3', 'p-1', 'Evening Medication', 'Atorvastatin 20mg + Multivitamin', '08:00 PM', 'Take before bed with water', 'evening', 'bg-indigo-50 text-indigo-700 border-indigo-200', now);

  // 5. Seed Medication Logs for today
  const insertMedLog = sqliteDb.prepare(`
    INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMedLog.run('mlog-1', 'med-1', 'p-1', 'taken', todayStr, '08:02 AM', now);
  insertMedLog.run('mlog-2', 'med-2', 'p-1', 'due', todayStr, null, now);
  insertMedLog.run('mlog-3', 'med-3', 'p-1', 'upcoming', todayStr, null, now);

  // 6. Seed Hydration Logs
  const insertHydration = sqliteDb.prepare(`
    INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertHydration.run('h-1', 'p-1', 250, '08:15 AM', now);
  insertHydration.run('h-2', 'p-1', 400, '10:30 AM', now);
  insertHydration.run('h-3', 'p-1', 250, '12:15 PM', now);
  insertHydration.run('h-4', 'p-1', 500, '02:00 PM', now);

  // 7. Seed Hydration Settings
  sqliteDb.prepare(`
    INSERT INTO hydration_settings (id, patient_id, daily_goal_liters, reminder_enabled, start_time, end_time, interval_minutes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('hyd-set-1', 'p-1', 2.0, 1, '08:00', '20:00', 60, now);

  // 8. Seed Activity Log
  sqliteDb.prepare(`
    INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('act-1', 'p-1', 4821, 5000, 32, 30, 185, 3.2, todayStr);

  // 9. Seed Escalation Rules
  const initialLevels = [
    { level: 1, title: 'Level 1: Soft Patient Reminder', target: 'Alex (Patient App)', delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
    { level: 2, title: 'Level 2: Repeated Reminder Tone', target: 'Alex (Patient App)', delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
    { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: 'Sarah Johnson (Caregiver)', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver Sarah.', enabled: true },
    { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
  ];

  sqliteDb.prepare(`
    INSERT INTO escalation_rules (id, patient_id, caregiver_name, caregiver_phone, caregiver_email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, quiet_hours_start, quiet_hours_end, max_reminders_before_escalation, repeat_reminder_interval_minutes, levels_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'esc-1',
    'p-1',
    'Sarah Johnson',
    '(555) 019-2831',
    'sarah.johnson@example.com',
    'Sarah Johnson (Daughter)',
    '(555) 019-2831',
    'Daughter & Primary Caregiver',
    '22:00',
    '07:00',
    3,
    15,
    JSON.stringify(initialLevels),
    now
  );

  // 10. Seed Connection Code
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sqliteDb.prepare(`
    INSERT INTO care_connection_codes (id, patient_id, code_hash, code_display, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'code-demo-1',
    'p-1',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    'CARE-ALEX72',
    expiresAt,
    now
  );
}
