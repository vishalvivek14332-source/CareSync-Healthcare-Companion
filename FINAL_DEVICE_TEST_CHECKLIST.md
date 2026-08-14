# CareSync Final Physical Device Validation Checklist (FINAL_DEVICE_TEST_CHECKLIST.md)

This runbook guides the complete physical Android validation of CareSync operating over a public HTTPS backend with the development computer powered **completely off**.

---

## 27-Step Physical Android Device Validation Protocol

| # | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Install release/debug APK on Android Phone (`adb install ...`). | App installs cleanly with icon "CareSync". | [ ] |
| 2 | Disconnect phone from development PC Wi-Fi; enable Mobile Data (4G/5G). | Phone has independent public internet connectivity. | [ ] |
| 3 | Completely power OFF development PC or stop local server. | Verifies zero dependency on developer machine. | [ ] |
| 4 | Launch CareSync application. | Welcome splash opens; shows Role Selection ("Patient" vs "Caregiver"). | [ ] |
| 5 | Select "I'm a Patient" and sign up with a new email. | Account created; redirected directly to Patient Dashboard. | [ ] |
| 6 | Verify CareScore on fresh patient account. | CareScore displays empty/unpenalized state (NOT 66). | [ ] |
| 7 | Create a medication schedule (e.g. 08:00 AM). | Medication appears in daily timeline with correct local time. | [ ] |
| 8 | Verify Android exact alarm notification. | Native notification triggers at scheduled medication time. | [ ] |
| 9 | Configure hydration settings (2.0L goal, 60m interval). | Reminders are scheduled; patient hydration bar shows 0L logged. | [ ] |
| 10| Tap "Enable Step Tracking" & grant `ACTIVITY_RECOGNITION`. | System permission prompt appears; step counter reads real hardware sensor. | [ ] |
| 11| Verify step counter displays real steps (or "Unavailable"). | Displays real hardware steps; zero fabricated default steps (no 4000). | [ ] |
| 12| Upload profile photo from phone gallery. | Image uploads to cloud storage; avatar renders on profile & header. | [ ] |
| 13| Note the unique `CARE-XXXXXX` connection code. | Connection code is visible and active. | [ ] |
| 14| On a secondary phone or web browser, sign up as "Caregiver". | Caregiver Hub opens with "Connect a Patient" view. | [ ] |
| 15| Enter patient's `CARE-XXXXXX` code on Caregiver device. | Patient is linked; caregiver sees patient metrics in real time. | [ ] |
| 16| Log dose as "Taken" on Patient phone. | Patient status updates; Caregiver timeline updates to "Taken". | [ ] |
| 17| Schedule a test dose and let it elapse past 45 minutes unconfirmed. | Escalation engine reaches Level 3. | [ ] |
| 18| Verify Caregiver Push Notification. | Caregiver device receives FCM high-severity push notification. | [ ] |
| 19| Tap "Log Out" in Patient settings. | Session closes; tokens are revoked on backend. | [ ] |
| 20| Sign in again with patient credentials. | Login succeeds; schedules, logs, and profile photo persist. | [ ] |
| 21| Force close / kill app from Android App Switcher. | Application terminates. | [ ] |
| 22| Reopen application. | Session is automatically restored; no re-login prompt needed. | [ ] |
| 23| Turn ON Airplane Mode (disable all networks). | Header badge updates to `OFFLINE`. | [ ] |
| 24| Log +250ml water intake and take scheduled dose while offline. | Action succeeds locally and is queued in `caresync_offline_queue`. | [ ] |
| 25| Turn OFF Airplane Mode (reconnect to internet). | Header shows `SYNCING` -> `ONLINE`; logs synchronize without duplicates. | [ ] |
| 26| Verify developer PC remains completely OFF. | App continues full production operations. | [ ] |
| 27| Verify CareScore updates dynamically based on confirmed logs. | CareScore increases deterministically. | [ ] |

---

## Output Verification

When you complete all 27 checks, sign off the release artifact for Play Store distribution.
