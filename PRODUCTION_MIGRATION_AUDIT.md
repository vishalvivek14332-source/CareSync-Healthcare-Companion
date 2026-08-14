# CareSync Production Migration & Architecture Audit

## 1. Executive Summary & Objective

This document audits the entirety of the CareSync codebase as part of migrating from a local-development setup (SQLite on developer PC over LAN Wi-Fi) to an enterprise, cloud-native production architecture:
- **Mobile Client**: Capacitor Android / React 19 / Web PWA -> Connects securely to `https://api.<domain>` (no LAN IP / localhost fallbacks).
- **Backend API**: Node.js / Express with TypeScript, short-lived JWT Access + Refresh token rotation, Helmet, rate limiting, request tracing, strict server-side RBAC, and object storage for profile assets.
- **Database Layer**: Managed PostgreSQL 16+ with ACID transactions, foreign keys (`ON DELETE CASCADE`), indexes, check constraints, `TIMESTAMPTZ`, and an isolated migration runner. SQLite retained exclusively for zero-config test suites and migration source.
- **Cloud Notification Service**: Firebase Cloud Messaging (FCM) abstraction for server-originated caregiver alerts and multi-level emergency escalations.

---

## 2. Current Architecture vs. Target Production Architecture

| Dimension | Current State | Target Production Architecture |
|---|---|---|
| **Database** | SQLite (`better-sqlite3`, `caresync.db`) on local filesystem | Managed PostgreSQL with connection pooling (`pg`), parameterization, row locking |
| **Authentication** | Single long-lived JWT in `localStorage` | Short-lived Access Token (15m) + Secure Refresh Token rotation (30d) in DB `refresh_tokens` |
| **API Origin** | Hardcoded/fallback `http://192.168.29.79:3000` | Configured `VITE_API_URL` -> `https://api.caresync.app` |
| **Profile Photos** | Base64 strings stored in SQLite | S3/Object Storage abstraction with 2MB limits & MIME validation |
| **Push Notifications** | Device-local notifications only | Multi-device FCM Push Notifications for Caregiver Alerts & Missed Dose Escalations |
| **Escalation Worker** | Single timer without distributed locking | PostgreSQL transaction-safe locking (`SELECT ... FOR UPDATE`) |
| **Medication Timezone** | Naive time strings (e.g. `08:00 AM`) | Explicit patient timezone column (`timezone` e.g. `America/New_York`) |
| **Offline Resilience** | Direct API failure | Offline-first client cache with Sync status indicator (`ONLINE`, `SYNCING`, `OFFLINE`) |

---

## 3. SQLite Query Inventory (All Database Operations)

Every query currently in the repository will be migrated to the unified database repository layer:

### A. Users & Authentication (`users`, `refresh_tokens`)
- `SELECT COUNT(*) FROM users`
- `SELECT * FROM users WHERE email = ?`
- `SELECT id, name, age, avatar_url, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, timezone FROM users WHERE id = ?`
- `INSERT INTO users (id, email, password_hash, role, name, age, phone, avatar_url, timezone, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, created_at)`
- `UPDATE users SET name = ?, age = ?, primary_caregiver = ?, caregiver_phone = ?, emergency_contact = ?, emergency_phone = ?, quiet_hours = ?, timezone = ? WHERE id = ?`
- `UPDATE users SET avatar_url = ? WHERE id = ?`
- `INSERT INTO refresh_tokens (id, user_id, token_hash, device_info, expires_at, created_at)`
- `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL`
- `UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`
- `UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ?`

### B. Caregiver-Patient Links & Codes (`caregiver_patient_links`, `care_connection_codes`)
- `SELECT patient_id FROM caregiver_patient_links WHERE caregiver_id = ?`
- `SELECT id FROM caregiver_patient_links WHERE caregiver_id = ? AND patient_id = ?`
- `SELECT u.* FROM users u JOIN caregiver_patient_links l ON u.id = l.patient_id WHERE l.caregiver_id = ?`
- `INSERT INTO caregiver_patient_links (id, caregiver_id, patient_id, link_code, created_at)`
- `SELECT * FROM care_connection_codes WHERE patient_id = ? AND revoked_at IS NULL AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
- `SELECT * FROM care_connection_codes WHERE code_hash = ?`
- `UPDATE care_connection_codes SET used_at = ? WHERE id = ?`
- `UPDATE care_connection_codes SET revoked_at = ? WHERE patient_id = ? AND revoked_at IS NULL`

### C. Medications & Escalation (`medications`, `medication_logs`, `medication_escalation_states`, `escalation_rules`)
- `SELECT * FROM medications WHERE patient_id = ? AND active = 1 ORDER BY scheduled_time ASC`
- `SELECT * FROM medications WHERE id = ?`
- `INSERT INTO medications (id, patient_id, name, dosage, scheduled_time, timezone, instructions, category, color, active, created_at)`
- `UPDATE medications SET name = ?, dosage = ?, scheduled_time = ?, timezone = ?, instructions = ?, category = ?, color = ? WHERE id = ?`
- `UPDATE medications SET active = 0 WHERE id = ?`
- `SELECT * FROM medication_logs WHERE medication_id = ? AND scheduled_date = ?`
- `INSERT INTO medication_logs (id, medication_id, patient_id, status, scheduled_date, taken_at, created_at)`
- `UPDATE medication_logs SET status = ?, taken_at = ? WHERE id = ?`
- `SELECT * FROM medication_escalation_states WHERE medication_id = ? AND scheduled_date = ?`
- `INSERT INTO medication_escalation_states (id, patient_id, medication_id, scheduled_date, scheduled_time, current_level, status, created_at, updated_at)`
- `UPDATE medication_escalation_states SET current_level = ?, last_escalated_at = ?, status = ?, updated_at = ? WHERE id = ?`
- `SELECT * FROM escalation_rules WHERE patient_id = ?`
- `INSERT INTO escalation_rules (id, patient_id, ...)`

### D. Hydration & Activity (`hydration_settings`, `hydration_logs`, `activity_logs`, `routine_items`)
- `SELECT * FROM hydration_settings WHERE patient_id = ?`
- `INSERT/UPDATE hydration_settings (daily_goal_liters, reminder_enabled, start_time, end_time, interval_minutes, timezone, ...)`
- `SELECT * FROM hydration_logs WHERE patient_id = ? AND date(logged_at) = date('now')`
- `INSERT INTO hydration_logs (id, patient_id, amount_ml, timestamp, logged_at)`
- `SELECT * FROM activity_logs WHERE patient_id = ? AND log_date = ?`
- `INSERT/UPDATE activity_logs (steps, active_minutes, distance_km, calories_burned, log_date)`
- `SELECT * FROM routine_items WHERE patient_id = ?`

### E. Alerts, Notifications, Device Push Tokens (`alerts`, `notifications`, `device_push_tokens`)
- `SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC`
- `INSERT INTO alerts (id, patient_id, patient_name, type, severity, title, description, ...)`
- `UPDATE alerts SET reviewed = 1 WHERE id = ?`
- `SELECT * FROM notifications WHERE patient_id = ? ORDER BY created_at DESC`
- `INSERT INTO notifications (id, patient_id, title, description, timestamp, type, ...)`
- `INSERT/UPDATE device_push_tokens (user_id, token, platform, updated_at)`

---

## 4. API Endpoints Inventory

| Route | Method | Access | RBAC & Security Check |
|---|---|---|---|
| `/api/health` | GET | Public | Returns API process health status |
| `/api/health/ready` | GET | Public | Verifies PostgreSQL DB pool responsiveness |
| `/api/auth/signup` | POST | Public | Rate-limited; validates role, hashes password with bcrypt |
| `/api/auth/login` | POST | Public | Rate-limited; returns 15m Access Token & 30d Refresh Token |
| `/api/auth/refresh` | POST | Public | Validates & rotates refresh token; issues new access/refresh pair |
| `/api/auth/logout` | POST | Authenticated | Revokes refresh token in database |
| `/api/auth/me` | GET | Authenticated | Returns current authenticated user profile |
| `/api/patient/profile` | GET / PUT | Authenticated | Patient only, or linked caregiver via `getAuthorizedPatientId` |
| `/api/patient/avatar` | POST / PUT | Authenticated | Max 2MB image, object storage upload, saves URL to DB |
| `/api/patient/connection-code` | GET | Patient Only | Retrieves active CARE-XXXXXX code |
| `/api/patient/connection-code/generate`| POST | Patient Only | Invalidates old codes; generates cryptographically random code |
| `/api/patient/connection-code/revoke`  | POST | Patient Only | Transactionally revokes active code |
| `/api/caregiver/patients` | GET | Caregiver Only | Lists verified linked patients |
| `/api/caregiver/link-patient` | POST | Caregiver Only | Redeems CARE-XXXXXX code atomically in transaction |
| `/api/medications` | GET / POST | Authenticated | Server-side authorization check (`getAuthorizedPatientId`) |
| `/api/medications/:id` | PUT / DELETE | Authenticated | IDOR check on medication ownership |
| `/api/medications/:id/log` | POST | Authenticated | Dose confirmation / status logging |
| `/api/hydration` | GET | Authenticated | Returns today's intake & schedule |
| `/api/hydration/settings` | GET / PUT | Authenticated | Manages intervals, goals, quiet times |
| `/api/hydration/log` | POST | Authenticated | Logs water intake amount |
| `/api/activity` | GET | Authenticated | Returns real steps / 7-day trend |
| `/api/activity/sync` | POST | Authenticated | Hardware pedometer / Health Connect sync |
| `/api/activity/session` | POST | Authenticated | Logs walk/exercise session |
| `/api/alerts` | GET | Authenticated | Fetches alerts with caregiver authorization |
| `/api/alerts/:id/review` | PUT | Authenticated | Marks alert reviewed |
| `/api/alerts/sos` | POST | Authenticated | Patient emergency trigger |
| `/api/notifications/register-token` | POST | Authenticated | Registers FCM device push token |

---

## 5. Hardcoded IP, Localhost & Security Inventory

1. **Previous LAN IP References**:
   - `src/services/api.ts` contained `DEFAULT_ANDROID_DEV_URL = 'http://192.168.29.79:3000'`.
   - **Fix**: Replaced by build-time `import.meta.env.VITE_API_URL`. In production, if `VITE_API_URL` is missing, the application fails fast.
2. **CORS Allowlist**:
   - `server.ts` previously had open `Access-Control-Allow-Origin: *`.
   - **Fix**: Replaced with strict CORS middleware accepting only configured origins (`CORS_ALLOWED_ORIGINS` e.g. `https://caresync.app`, `capacitor://localhost`, `http://localhost`).
3. **Database Secrets**:
   - Hardcoded database credentials eliminated; `DATABASE_URL` is read strictly from environment variables.
4. **JWT Secrets**:
   - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` validated at server start; server refuses to boot in production if default/insecure secrets are present.

---

## 6. Migration Execution Plan & File Modification Map

1. **[`server/config.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/config.ts)**: Environment loader with fail-fast validation.
2. **[`server/db.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/db.ts)**: Unified PostgreSQL repository adapter with transaction support and SQLite fallback for local test runners.
3. **[`scripts/migrate-sqlite-to-postgres.ts`](file:///c:/Users/visha/Downloads/caresync-main/scripts/migrate-sqlite-to-postgres.ts)**: Data migration utility.
4. **[`server/auth.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/auth.ts)** & **[`server/routes/authRoutes.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/routes/authRoutes.ts)**: Refresh token rotation, logout, rate limiting.
5. **[`server/services/fcmService.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/services/fcmService.ts)**: Firebase Cloud Messaging integration.
6. **[`server/services/storageService.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/services/storageService.ts)**: Object storage service for profile photos.
7. **[`server/services/escalationWorker.ts`](file:///c:/Users/visha/Downloads/caresync-main/server/services/escalationWorker.ts)**: Transactional row-locking escalation processing.
8. **[`src/services/api.ts`](file:///c:/Users/visha/Downloads/caresync-main/src/services/api.ts)**: Production API client with single-flight refresh on 401 and error classification.
9. **[`src/context/CareSyncContext.tsx`](file:///c:/Users/visha/Downloads/caresync-main/src/context/CareSyncContext.tsx)**: Offline cache and sync status state.
10. **[`server.ts`](file:///c:/Users/visha/Downloads/caresync-main/server.ts)**: Helmet, strict CORS, rate limiters, `/api/health`, `/api/health/ready`.
11. **[`docs/PRODUCTION_DEPLOYMENT.md`](file:///c:/Users/visha/Downloads/caresync-main/docs/PRODUCTION_DEPLOYMENT.md)** & **[`docs/CARESCORE.md`](file:///c:/Users/visha/Downloads/caresync-main/docs/CARESCORE.md)**: Deployment and scoring documentation.
12. **Environment Templates**: `.env.example`, `.env.development.example`, `.env.production.example`.
