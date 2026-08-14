# CareSync Production Deployment & Verification Runbook

This comprehensive operational guide details the step-by-step procedure for deploying, verifying, and maintaining CareSync in a production cloud and mobile environment.

---

## Part 1: Production Infrastructure & Cloud Setup

### 1. Create Managed PostgreSQL Database
- Provision a PostgreSQL 16+ instance on AWS RDS, Supabase, Neon, or Google Cloud SQL.
- Configure SSL requirement (`sslmode=require`) and automated daily backups with PITR.
- Set connection string:
  ```bash
  export DATABASE_URL="postgresql://caresync_admin:<PASSWORD>@<HOST>:5432/caresync_prod?sslmode=require"
  ```

### 2. Configure Production Environment Variables
Set the following environment variables in your production container/host (e.g. AWS ECS, Render, Railway):
```bash
NODE_ENV=production
PORT=443
DATABASE_URL=postgresql://caresync_admin:...
JWT_ACCESS_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
CORS_ALLOWED_ORIGINS=https://app.caresync.com,capacitor://localhost
VITE_API_URL=https://api.caresync.com
FCM_SERVER_KEY=AAAA...
STORAGE_PROVIDER=s3
STORAGE_BUCKET=caresync-production-assets
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### 3. Run Database Migrations
Run the transactional PostgreSQL migration runner:
```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

### 4. Deploy Backend Server
Build and start the Node.js production service:
```bash
npm ci
npm run build
npm run start
```

### 5. Verify Liveness Health Endpoint
```bash
curl -i https://api.caresync.com/api/health
# Response: HTTP 200 {"status":"ok","uptimeSeconds":...,"environment":"production"}
```

### 6. Verify Database Readiness Probe
```bash
curl -i https://api.caresync.com/api/health/ready
# Response: HTTP 200 {"status":"ready","database":{"ok":true,"type":"PostgreSQL","latencyMs":...}}
```

### 7. Configure Firebase Cloud Messaging (FCM)
1. Open the Firebase Console and create a project (`caresync-prod`).
2. Register the Android package `com.caresync.app`.
3. Download `google-services.json` to `android/app/google-services.json`.
4. Copy the FCM Server Key / Service Account credentials into `FCM_SERVER_KEY`.

### 8. Configure Cloud Object Storage (Amazon S3 / R2)
1. Create private S3 bucket `caresync-production-assets`.
2. Configure bucket CORS to allow `GET`, `PUT` from `https://app.caresync.com` and `capacitor://localhost`.
3. Ensure IAM role or credentials have `s3:PutObject` and `s3:GetObject` permissions.

---

## Part 2: Android Production Build & Release

### 9. Build Frontend with Production API Domain
```bash
export VITE_API_URL="https://api.caresync.com"
npm run build
```

### 10. Build Android Production APK / Android App Bundle (AAB)
```bash
npx cap sync android
cd android
./gradlew bundleRelease  # or ./gradlew assembleRelease for APK
```
*Note: Verify that `networkSecurityConfig` contains no LAN IPs or cleartext endpoints.*

---

## Part 3: Real-Device Verification Checklist (20-Step Protocol)

1. **Install on Real Phone**:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```
2. **Launch & Independent Operation**:
   - Turn off / stop the developer PC's local server.
   - Launch CareSync on the phone. Verify it reaches `https://api.caresync.com` without needing developer PC Wi-Fi.
3. **Patient Registration & Onboarding**:
   - Sign up with a new email.
   - Verify CareScore begins in a neutral/unpenalized state.
4. **Caregiver Registration**:
   - Sign up as Caregiver on a secondary device.
5. **Patient-Caregiver Secure Link**:
   - Enter patient's `CARE-XXXXXX` connection code on caregiver hub.
   - Confirm patient appears immediately on caregiver dashboard.
6. **Medication Scheduling**:
   - Add a morning medication (e.g. 08:00 AM).
   - Confirm patient schedule displays the medication.
7. **Local Medication Alarms**:
   - Verify Android system alarm/notification triggers at scheduled time.
8. **Hydration Scheduling & Reminders**:
   - Configure hydration goal (2.0L) and interval (60m).
   - Confirm hydration reminder notification schedule.
9. **Activity Permissions & Step Sync**:
   - Grant `ACTIVITY_RECOGNITION` permission.
   - Confirm hardware step counter syncs without fake baselines.
10. **Profile Photo Selection**:
    - Pick photo from device gallery.
    - Confirm image uploads and persists to cloud storage.
11. **Dose Confirmation**:
    - Tap "Taken" on patient dose.
    - Verify caregiver view updates status to `taken` with timestamp.
12. **Caregiver Escalation Alert & FCM**:
    - Allow unconfirmed dose to exceed 45 minutes.
    - Confirm escalation worker logs Level 3 and dispatches FCM push notification to caregiver's phone.
13. **Offline Resilience & Queue**:
    - Enable Airplane Mode on phone.
    - Verify app displays `OFFLINE` status pill in header.
    - Log water intake and dose offline.
14. **Online Recovery & Sync**:
    - Disable Airplane Mode.
    - Verify status updates to `SYNCING` -> `ONLINE` and offline queue is flushed to backend.
15. **Logout & Session Revocation**:
    - Tap Logout.
    - Confirm refresh token is revoked in database.
16. **Re-Authentication & Persistence**:
    - Sign in again.
    - Confirm all previous schedules, logs, and profile photo persist accurately.
