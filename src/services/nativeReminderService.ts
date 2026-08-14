import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logMedicationDoseApi } from './api';

export const MEDICATION_ACTION_GROUP = 'MEDICATION_ALARM_ACTIONS';

let isInitialized = false;

/**
 * Initialize native Android LocalNotification channels, permissions, and action button listeners.
 */
export async function initNativeNotifications(onDoseConfirmed?: (medId: string) => void) {
  if (isInitialized) return;
  if (!Capacitor.isNativePlatform()) {
    console.log('[NativeReminders] Web browser environment. Native Android alarms disabled.');
    return;
  }

  try {
    // 1. Check and request notification permissions
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 2. Create high-priority Android alarm channel
    await LocalNotifications.createChannel({
      id: 'medication-alarms',
      name: 'Medication Alarms',
      description: 'High-priority sound and vibration reminders for scheduled medication doses',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,  // VISIBILITY_PUBLIC
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#0F766E',
    });

    // 3. Register Action Types (Taken & Snooze buttons)
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MEDICATION_ACTION_GROUP,
          actions: [
            {
              id: 'TAKEN',
              title: '✓ Mark as Taken',
              foreground: true,
            },
            {
              id: 'SNOOZE',
              title: '⏰ Snooze (10m)',
              foreground: false,
            },
          ],
        },
      ],
    });

    // 4. Register action button tap listeners
    LocalNotifications.addListener('localNotificationActionPerformed', async (action: ActionPerformed) => {
      console.log('[NativeReminders] Notification Action Performed:', action.actionId, action.notification);
      const extra = action.notification.extra || {};
      const medicationId = extra.medicationId || 'm-1';

      if (action.actionId === 'TAKEN') {
        try {
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await logMedicationDoseApi(medicationId, 'taken', nowTime);
          console.log(`[NativeReminders] Successfully logged ${medicationId} as TAKEN via Android notification action.`);
          if (onDoseConfirmed) onDoseConfirmed(medicationId);
        } catch (err) {
          console.error('[NativeReminders] Failed to transmit TAKEN action to backend:', err);
        }
      } else if (action.actionId === 'SNOOZE') {
        // Reschedule +10 minutes into the future
        const snoozeTime = new Date(Date.now() + 10 * 60 * 1000);
        const snoozeId = Math.floor(Math.random() * 100000);
        await LocalNotifications.schedule({
          notifications: [
            {
              title: '🔔 Medication Time (Snoozed)',
              body: action.notification.body,
              id: snoozeId,
              schedule: { at: snoozeTime, allowWhileIdle: true },
              sound: 'beep.wav',
              actionTypeId: MEDICATION_ACTION_GROUP,
              extra: extra,
              channelId: 'medication-alarms',
            },
          ],
        });
        console.log(`[NativeReminders] Snoozed dose ${medicationId} to ${snoozeTime.toLocaleTimeString()}`);
      }
    });

    isInitialized = true;
    console.log('[NativeReminders] Native Android Notification Service initialized successfully.');
  } catch (err) {
    console.error('[NativeReminders] Error initializing native notifications:', err);
  }
}

/**
 * Schedule a native Android local notification alarm for a specific medication dose.
 */
export async function scheduleNativeMedicationAlarm(
  medicationId: string,
  medicationName: string,
  dosage: string,
  scheduledTime: Date
) {
  if (!Capacitor.isNativePlatform()) {
    console.log(`[NativeReminders:Web Simulation] Native reminder set for ${medicationName} at ${scheduledTime.toLocaleTimeString()}`);
    return;
  }

  const notificationId = Math.abs(hashCode(`${medicationId}_${scheduledTime.getTime()}`));

  await LocalNotifications.schedule({
    notifications: [
      {
        title: '🔔 Medication Time',
        body: `💊 ${medicationName}\nTake ${dosage}`,
        id: notificationId,
        schedule: { at: scheduledTime, allowWhileIdle: true },
        sound: 'beep.wav',
        actionTypeId: MEDICATION_ACTION_GROUP,
        extra: { medicationId, medicationName, dosage },
        channelId: 'medication-alarms',
      },
    ],
  });
  console.log(`[NativeReminders] Native Android alarm scheduled: ${medicationName} (${dosage}) at ${scheduledTime.toLocaleTimeString()}`);
}

/**
 * Synchronize all native medication alarms for the authenticated patient.
 * Automatically removes stale/deleted alarms and schedules updated alarms.
 * Caregiver devices will cancel alarms and never schedule alarms for other patients.
 */
export async function syncNativeMedicationAlarms(
  medications: Array<{ id: string; name: string; dosage: string; scheduledTime: string; status?: string; active?: number }>,
  userRole: 'patient' | 'caregiver' = 'patient'
) {
  // 1. If user is a caregiver, cancel any local medication alarms immediately (patient device is the sole alarm owner)
  if (userRole !== 'patient') {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
          console.log('[NativeReminders] Cancelled pending alarms because user role is caregiver.');
        }
      } catch (err) {
        console.error('[NativeReminders] Error clearing caregiver alarms:', err);
      }
    }
    console.log('[NativeReminders] Caregiver device: 0 alarms scheduled (patient device is the sole alarm owner).');
    return { scheduledCount: 0, role: userRole, cancelled: true };
  }

  // 2. Filter active, non-taken medications for today on patient device
  const activeMeds = medications.filter((m) => m.active !== 0 && m.status !== 'taken');

  if (!Capacitor.isNativePlatform()) {
    console.log(`[NativeReminders:Web Simulation] Synchronized ${activeMeds.length} active alarms for patient.`);
    return { scheduledCount: activeMeds.length, role: userRole, cancelled: false };
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    for (const med of activeMeds) {
      const match = med.scheduledTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) continue;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3]?.toUpperCase();
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;

      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);

      if (scheduledDate.getTime() < Date.now()) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      await scheduleNativeMedicationAlarm(med.id, med.name, med.dosage, scheduledDate);
    }

    console.log(`[NativeReminders] Successfully synchronized ${activeMeds.length} active alarms on patient device.`);
  } catch (err) {
    console.error('[NativeReminders] Error synchronizing native medication alarms:', err);
  }

  return { scheduledCount: activeMeds.length, role: userRole, cancelled: false };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
