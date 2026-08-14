# CareSync Production Gap & Readiness Audit (PRODUCTION_GAP_AUDIT.md)

**Audit Date**: 2026-08-14  
**Project**: CareSync Production Healthcare & Caregiving System  
**Target Environment**: Cloud-Native Backend (Node.js + PostgreSQL) + Native Android (Capacitor) + Web PWA  

---

## 1. Executive Summary & Audit Matrix

| Production Area | Status | Key Findings & Verification | Required Action |
|---|---|---|---|
| **1. API URL Strategy** | ⚠️ WARNING | `getApiBaseUrl()` reads `VITE_API_URL`, but if missing on native Android, fallback to empty string causes relative WebView resolution. | Add strict Native + Production startup validation. Reject relative URLs on Capacitor Native. |
| **2. Database & PostgreSQL** | ✅ PASS | Managed PostgreSQL connection pool (`pg.Pool`) with ACID transactions, cascades, indexes, check constraints. SQLite isolated for test/local runner. | Enforce fail-fast check if `NODE_ENV=production` and `DATABASE_URL` is unset or invalid. |
| **3. SQLite Migration Script** | ✅ PASS | `scripts/migrate-sqlite-to-postgres.ts` executes atomic transactional data migration for all 10+ tables with rollback safety. | Document execution command in `PRODUCTION_DEPLOYMENT.md`. |
| **4. Authentication & JWT** | ✅ PASS | 15-minute Access Token + 30-day SHA-256 hashed Refresh Token in `refresh_tokens`. Replay detection automatically invalidates compromised user sessions. | Verified in E2E Test 25–28. |
| **5. Android Release & Permissions** | ⚠️ WARNING | `network_security_config.xml` had hardcoded `192.168.29.79`. Permissions for notifications, alarms, activity, and camera are present. | Strip hardcoded LAN IP from XML. Ensure cleartext is disabled in release builds. |
| **6. Offline Queue & Sync** | ⚠️ WARNING | Client handles offline detection, but offline dose/hydration logs were not persisted to a durable replay queue. | Implement durable `caresync_offline_queue` with deterministic replay upon reconnection. |
| **7. Firebase Cloud Messaging (FCM)** | ⚠️ WARNING | FCM backend service and device push token registration (`/api/notifications/register-token`) implemented, but production requires real Firebase Project ID and Service Account. | Add Firebase Admin / FCM credential configuration and document device testing steps. |
| **8. Profile Asset Storage** | ⚠️ WARNING | Object storage abstraction in `storageService.ts` supports 2MB limits and MIME validation, but cloud S3 upload needs explicit AWS SDK / cloud credentials in production. | Mark unconfigured S3 bucket as deployment blocker in production mode. |
| **9. Security, Helmet & CORS** | ✅ PASS | Helmet headers, CORS origin allowlist, rate limiting on `/api/auth/*`, `X-Request-ID` tracing, no leaked stack traces. | Maintain in `server.ts`. |
| **10. Zero Fake Data / CareScore** | ✅ PASS | Legacy default 66 eliminated. Fresh patients receive unpenalized baseline with dynamic weights. | Verified across onboarding and calculation tests. |

---

## 2. Detailed Gap Analysis & Checklist

### A. Hardcoded IP & Localhost Inventory
- **Findings**:
  - `src/services/api.ts`: Zero hardcoded IP fallbacks in production.
  - `android/app/src/main/res/xml/network_security_config.xml`: Contained `192.168.29.79`. **[ACTION: Removed]**
  - Production builds MUST be compiled with `VITE_API_URL=https://api.caresync.app`.

### B. Android Native WebView Origin Isolation
- **Findings**:
  - Capacitor Android serves web assets from `http://localhost` or `capacitor://localhost`.
  - When `VITE_API_URL` is omitted, API calls default to relative paths `/api/...`, which Android WebView intercepts as local HTML files (`index.html`).
  - **Required Action**: In `src/services/api.ts`, detect Capacitor Native environment. If `VITE_API_URL` is not set and no custom server URL is saved, throw a explicit `ApiError('CONFIGURATION_ERROR')` and render a clear setup screen instead of crashing on HTML response.

### C. Database Fail-Fast & Connection Verification
- **Findings**:
  - `server/config.ts` validates that `DATABASE_URL` is present when `NODE_ENV === 'production'`.
  - `/api/health/ready` executes `SELECT 1` on `pgPool` to verify PostgreSQL responsiveness.

### D. Offline-First Resilience & Sync Queue
- **Findings**:
  - If a patient takes a pill or logs water while in a cellular dead zone, the app must store the action in `localStorage.getItem('caresync_offline_queue')`.
  - When the browser/device detects network recovery (`online` event), `flushOfflineQueue()` replays the requests with the stored authorization token and updates the sync indicator to `ONLINE`.

---

## 3. Required Production Environment Variables

```bash
NODE_ENV=production
PORT=443
DATABASE_URL=postgresql://caresync_user:secure_password@prod-db.internal:5432/caresync_prod?sslmode=require
JWT_ACCESS_SECRET=64_char_hex_secret_here
JWT_REFRESH_SECRET=64_char_hex_secret_here
CORS_ALLOWED_ORIGINS=https://app.caresync.app,capacitor://localhost
VITE_API_URL=https://api.caresync.app
FCM_SERVER_KEY=
STORAGE_PROVIDER=s3
STORAGE_BUCKET=caresync-production-assets
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```
