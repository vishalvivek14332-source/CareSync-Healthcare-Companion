import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'caresync.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('patient', 'caregiver')),
      name TEXT NOT NULL,
      age INTEGER,
      phone TEXT,
      avatar_url TEXT,
      primary_caregiver TEXT,
      caregiver_phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      quiet_hours TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caregiver_patient_links (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      link_code TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      instructions TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('morning', 'afternoon', 'evening')),
      color TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      steps INTEGER NOT NULL DEFAULT 0,
      step_goal INTEGER NOT NULL DEFAULT 5000,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      active_minutes_goal INTEGER NOT NULL DEFAULT 30,
      calories_burned INTEGER NOT NULL DEFAULT 185,
      distance_km REAL NOT NULL DEFAULT 3.2,
      log_date TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
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
      code_hash TEXT NOT NULL,
      code_display TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedData();
}

function seedData() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) return; // DB already seeded

  const passwordHash = bcrypt.hashSync('password123', 10);
  const now = new Date().toISOString();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Seed Users
  db.prepare(`
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

  db.prepare(`
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

  // 2. Link Caregiver & Patient
  db.prepare(`
    INSERT INTO caregiver_patient_links (id, caregiver_id, patient_id, link_code, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('link-1', 'c-1', 'p-1', 'ALEX72', now);

  // 3. Seed Medications
  const insertMed = db.prepare(`
    INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, instructions, category, color, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  insertMed.run('med-1', 'p-1', 'Morning Medication', 'Vitamin D3 (2,000 IU) + Lisinopril 10mg', '08:00 AM', 'Take with full glass of water after breakfast', 'morning', 'bg-emerald-50 text-emerald-700 border-emerald-200', now);
  insertMed.run('med-2', 'p-1', 'Afternoon Medication', 'Calcium Citrate 500mg', '01:00 PM', 'Take 1 tablet with light snack', 'afternoon', 'bg-amber-50 text-amber-800 border-amber-200', now);
  insertMed.run('med-3', 'p-1', 'Evening Medication', 'Atorvastatin 20mg + Multivitamin', '08:00 PM', 'Take before bed with water', 'evening', 'bg-indigo-50 text-indigo-700 border-indigo-200', now);

  // 4. Seed Medication Logs for today
  const insertMedLog = db.prepare(`
    INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMedLog.run('mlog-1', 'med-1', 'p-1', 'taken', todayStr, '08:02 AM', now);
  insertMedLog.run('mlog-2', 'med-2', 'p-1', 'due', todayStr, null, now);
  insertMedLog.run('mlog-3', 'med-3', 'p-1', 'upcoming', todayStr, null, now);

  // 5. Seed Hydration Logs
  const insertHydration = db.prepare(`
    INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertHydration.run('h-1', 'p-1', 250, '08:15 AM', now);
  insertHydration.run('h-2', 'p-1', 400, '10:30 AM', now);
  insertHydration.run('h-3', 'p-1', 250, '12:15 PM', now);
  insertHydration.run('h-4', 'p-1', 500, '02:00 PM', now);

  // 6. Seed Activity Log
  db.prepare(`
    INSERT INTO activity_logs (id, patient_id, steps, step_goal, active_minutes, active_minutes_goal, calories_burned, distance_km, log_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('act-1', 'p-1', 4821, 5000, 32, 30, 185, 3.2, todayStr);

  // 7. Seed Routine Items
  const insertRoutine = db.prepare(`
    INSERT INTO routine_items (id, patient_id, title, time, completed, category, icon_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRoutine.run('r-1', 'p-1', 'Morning medication', '8:00 AM', 1, 'medication', 'Pill');
  insertRoutine.run('r-2', 'p-1', 'Healthy Breakfast', '8:30 AM', 1, 'wellness', 'Utensils');
  insertRoutine.run('r-3', 'p-1', 'Hydration goal (1.4L achieved)', '10:00 AM', 1, 'hydration', 'Droplet');
  insertRoutine.run('r-4', 'p-1', 'Morning 20-min Walk', '10:30 AM', 1, 'activity', 'Footprints');
  insertRoutine.run('r-5', 'p-1', 'Afternoon medication', '1:00 PM', 0, 'medication', 'Pill');
  insertRoutine.run('r-6', 'p-1', 'Evening medication', '8:00 PM', 0, 'medication', 'Pill');
  insertRoutine.run('r-7', 'p-1', 'Gentle Sleep Routine', '10:00 PM', 0, 'wellness', 'Moon');

  // 8. Seed Alerts
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, reviewed, action_text, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAlert.run('alt-1', 'p-1', 'Alex Johnson', 'medication_reminder', 'medium', 'Medication Reminder', 'Evening medication has not been confirmed yet.', 0, 'Send Gentle Reminder', 'Yesterday at 8:45 PM', now);
  insertAlert.run('alt-2', 'p-1', 'Alex Johnson', 'missed_medication', 'high', 'Missed Medication Alert', 'Evening medication was not confirmed after 3 repeated reminders.', 0, 'Contact Alex', '2 days ago', now);
  insertAlert.run('alt-3', 'p-1', 'Alex Johnson', 'routine_insight', 'low', 'Routine Pattern Observation', 'Walking activity has been slightly lower than average for the last 3 days.', 1, 'View Activity Graph', '3 days ago', now);

  // 9. Seed Escalation Rules
  const initialLevels = [
    { level: 1, title: 'Level 1: Soft Patient Reminder', target: 'Alex (Patient App)', delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
    { level: 2, title: 'Level 2: Repeated Reminder Tone', target: 'Alex (Patient App)', delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
    { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: 'Sarah Johnson (Caregiver)', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver Sarah.', enabled: true },
    { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
  ];

  db.prepare(`
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

  // 10. Seed Care Connection Code for Patient Alex
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO care_connection_codes (id, patient_id, code_hash, code_display, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'code-demo-1',
    'p-1',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // sha256 for CARE-ALEX72
    'CARE-ALEX72',
    expiresAt,
    now
  );
}
