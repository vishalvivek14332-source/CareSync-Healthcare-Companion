import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logMedicationDoseApi, logHydrationApi } from './api';
import { Medication, HydrationSchedule, HydrationSettings } from '../types';

export const MEDICATION_ACTION_GROUP = 'MEDICATION_ALARM_ACTIONS';
export const HYDRATION_ACTION_GROUP = 'HYDRATION_ALARM_ACTIONS';
export const HYDRATION_NOTIFICATION_CHANNEL = 'hydration-alarms';
export const MEDICATION_NOTIFICATION_CHANNEL = 'medication-alarms';

let isInitialized = false;

export interface AlarmTriggerPayload {
  id: string;
  type: 'medication' | 'hydration';
  title: string;
  subtitle?: string;
  scheduledTime: string;
  dosageOrAmount: string;
  instructions?: string;
  extra?: any;
}

type AlarmCallback = (payload: AlarmTriggerPayload) => void;
type DoseConfirmedCallback = (medId: string) => void;
type WaterConfirmedCallback = (amountMl: number) => void;

let onAlarmTriggeredHandler: AlarmCallback | null = null;
let onDoseConfirmedHandler: DoseConfirmedCallback | null = null;
let onWaterConfirmedHandler: WaterConfirmedCallback | null = null;

export function setAlarmTriggerHandler(handler: AlarmCallback) {
  onAlarmTriggeredHandler = handler;
}

export function setDoseConfirmedHandler(handler: DoseConfirmedCallback) {
  onDoseConfirmedHandler = handler;
}

export function setWaterConfirmedHandler(handler: WaterConfirmedCallback) {
  onWaterConfirmedHandler = handler;
}

/**
 * Initialize native Android LocalNotification channels, permissions, and action button listeners.
 */
export async function initNativeNotifications(
  onDoseConfirmed?: DoseConfirmedCallback,
  onAlarmTriggered?: AlarmCallback,
  onWaterConfirmed?: WaterConfirmedCallback
) {
  if (onDoseConfirmed) onDoseConfirmedHandler = onDoseConfirmed;
  if (onAlarmTriggered) onAlarmTriggeredHandler = onAlarmTriggered;
  if (onWaterConfirmed) onWaterConfirmedHandler = onWaterConfirmed;

  if (isInitialized) return;
  if (!Capacitor.isNativePlatform()) {
    console.log('[NativeReminders] Web browser environment. Native Android alarms simulation active.');
    return;
  }

  try {
    // 1. Check and request notification permissions
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 2. Create high-priority Android alarm channel for medications
    await LocalNotifications.createChannel({
      id: MEDICATION_NOTIFICATION_CHANNEL,
      name: 'Medication Alarms',
      description: 'High-priority sound and vibration reminders for scheduled medication doses',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,  // VISIBILITY_PUBLIC
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#0F766E',
    });

    // 3. Create high-priority hydration alarms channel
    await LocalNotifications.createChannel({
      id: HYDRATION_NOTIFICATION_CHANNEL,
      name: 'Hydration Alarms',
      description: 'High-priority water intake reminders and hydration goals',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#0284C7',
    });

    // 4. Register Action Types for Medication & Hydration
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MEDICATION_ACTION_GROUP,
          actions: [
            {
              id: 'TAKEN',
              title: '✓ Confirm Taken',
              foreground: true,
            },
            {
              id: 'SNOOZE_10',
              title: '⏰ Snooze (10m)',
              foreground: false,
            },
            {
              id: 'DISMISS',
              title: '✕ Dismiss',
              foreground: false,
              destructive: true,
            },
          ],
        },
        {
          id: HYDRATION_ACTION_GROUP,
          actions: [
            {
              id: 'DRANK',
              title: '✓ Log Drank',
              foreground: true,
            },
            {
              id: 'SNOOZE_10',
              title: '⏰ Snooze (10m)',
              foreground: false,
            },
            {
              id: 'DISMISS',
              title: '✕ Dismiss',
              foreground: false,
              destructive: true,
            },
          ],
        },
      ],
    });

    // 5. Register notification received (foreground) listener
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('[NativeReminders] Notification Received in foreground:', notification);
      const extra = notification.extra || {};
      if (onAlarmTriggeredHandler) {
        onAlarmTriggeredHandler({
          id: String(notification.id),
          type: extra.type || (notification.channelId === HYDRATION_NOTIFICATION_CHANNEL ? 'hydration' : 'medication'),
          title: notification.title,
          subtitle: notification.body,
          scheduledTime: extra.scheduledTime || 'Now',
          dosageOrAmount: extra.dosage || (extra.amountMl ? `${extra.amountMl} ml` : 'Prescribed dose'),
          instructions: extra.instructions,
          extra,
        });
      }
    });

    // 6. Register action button tap listeners
    LocalNotifications.addListener('localNotificationActionPerformed', async (action: ActionPerformed) => {
      console.log('[NativeReminders] Notification Action Performed:', action.actionId, action.notification);
      const extra = action.notification.extra || {};
      const type = extra.type || (action.notification.channelId === HYDRATION_NOTIFICATION_CHANNEL ? 'hydration' : 'medication');

      if (type === 'medication') {
        const medicationId = extra.medicationId || 'm-1';

        if (action.actionId === 'TAKEN' || action.actionId === 'tap') {
          if (action.actionId === 'TAKEN') {
            try {
              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              await logMedicationDoseApi(medicationId, 'taken', nowTime);
              if (onDoseConfirmedHandler) onDoseConfirmedHandler(medicationId);
            } catch (err) {
              console.error('[NativeReminders] Failed to log TAKEN action:', err);
            }
          } else if (onAlarmTriggeredHandler) {
            onAlarmTriggeredHandler({
              id: String(action.notification.id),
              type: 'medication',
              title: action.notification.title,
              subtitle: action.notification.body,
              scheduledTime: extra.scheduledTime || 'Now',
              dosageOrAmount: extra.dosage || 'Prescribed dose',
              instructions: extra.instructions,
              extra,
            });
          }
        } else if (action.actionId === 'SNOOZE_10') {
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
                extra,
                channelId: MEDICATION_NOTIFICATION_CHANNEL,
              },
            ],
          });
        }
      } else if (type === 'hydration') {
        const amountMl = extra.amountMl || 250;

        if (action.actionId === 'DRANK') {
          try {
            await logHydrationApi(amountMl);
            if (onWaterConfirmedHandler) onWaterConfirmedHandler(amountMl);
          } catch (err) {
            console.error('[NativeReminders] Failed to log DRANK action:', err);
          }
        } else if (action.actionId === 'tap') {
          if (onAlarmTriggeredHandler) {
            onAlarmTriggeredHandler({
              id: String(action.notification.id),
              type: 'hydration',
              title: action.notification.title,
              subtitle: action.notification.body,
              scheduledTime: extra.scheduledTime || 'Now',
              dosageOrAmount: `${amountMl} ml`,
              extra,
            });
          }
        } else if (action.actionId === 'SNOOZE_10') {
          const snoozeTime = new Date(Date.now() + 10 * 60 * 1000);
          const snoozeId = 900000 + Math.floor(Math.random() * 9999);
          await LocalNotifications.schedule({
            notifications: [
              {
                title: '💧 Hydration Break (Snoozed)',
                body: `Stay refreshed! Drink ${amountMl} ml of water.`,
                id: snoozeId,
                schedule: { at: snoozeTime, allowWhileIdle: true },
                sound: 'beep.wav',
                actionTypeId: HYDRATION_ACTION_GROUP,
                extra,
                channelId: HYDRATION_NOTIFICATION_CHANNEL,
              },
            ],
          });
        }
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
  scheduledTime: Date,
  instructions?: string
) {
  if (!Capacitor.isNativePlatform()) {
    console.log(`[NativeReminders:Web Simulation] Native reminder set for ${medicationName} at ${scheduledTime.toLocaleTimeString()}`);
    return;
  }

  const notificationId = 100000 + (Math.abs(hashCode(`${medicationId}_${scheduledTime.getTime()}`)) % 799999);

  await LocalNotifications.schedule({
    notifications: [
      {
        title: '🔔 Medication Alarm',
        body: `💊 ${medicationName} (${dosage}) is scheduled now.`,
        id: notificationId,
        schedule: { at: scheduledTime, allowWhileIdle: true },
        sound: 'beep.wav',
        actionTypeId: MEDICATION_ACTION_GROUP,
        extra: {
          medicationId,
          medicationName,
          dosage,
          instructions,
          scheduledTime: scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'medication',
        },
        channelId: MEDICATION_NOTIFICATION_CHANNEL,
      },
    ],
  });
}

/**
 * Synchronize all native medication alarms for the authenticated patient.
 */
export async function syncNativeMedicationAlarms(
  medications: Medication[],
  userRole: 'patient' | 'caregiver' = 'patient'
) {
  if (userRole !== 'patient') {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        const medNotifications = pending.notifications.filter((n) => n.id < 900000);
        if (medNotifications.length > 0) {
          await LocalNotifications.cancel({ notifications: medNotifications });
        }
      } catch (err) {
        console.error('[NativeReminders] Error clearing caregiver alarms:', err);
      }
    }
    return { scheduledCount: 0, role: userRole, cancelled: true };
  }

  const activeMeds = medications.filter((m) => m.active !== 0 && m.status !== 'taken');

  if (!Capacitor.isNativePlatform()) {
    console.log(`[NativeReminders:Web Simulation] Synchronized ${activeMeds.length} active alarms for patient.`);
    return { scheduledCount: activeMeds.length, role: userRole, cancelled: false };
  }

  try {
    const pending = await LocalNotifications.getPending();
    const medNotifications = pending.notifications.filter((n) => n.id < 900000);
    if (medNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: medNotifications });
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

      await scheduleNativeMedicationAlarm(med.id, med.name, med.dosage, scheduledDate, med.instructions);
    }

    console.log(`[NativeReminders] Successfully synchronized ${activeMeds.length} active alarms on patient device.`);
  } catch (err) {
    console.error('[NativeReminders] Error synchronizing native medication alarms:', err);
  }

  return { scheduledCount: activeMeds.length, role: userRole, cancelled: false };
}

/**
 * Synchronize native hydration reminder schedule on patient device.
 * Supports multi-slot discrete schedules as well as interval settings fallback.
 */
export async function syncNativeHydrationReminders(
  settings: HydrationSettings,
  userRole: 'patient' | 'caregiver' = 'patient',
  schedules: HydrationSchedule[] = []
) {
  if (userRole !== 'patient' || !settings.reminderEnabled) {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        const hydrationPending = pending.notifications.filter((n) => n.id >= 900000);
        if (hydrationPending.length > 0) {
          await LocalNotifications.cancel({ notifications: hydrationPending });
        }
      } catch (err) {
        console.error('[NativeReminders] Error cancelling hydration reminders:', err);
      }
    }
    return { scheduledCount: 0, enabled: false };
  }

  if (!Capacitor.isNativePlatform()) {
    const count = schedules.length > 0 ? schedules.filter((s) => s.enabled).length : 8;
    console.log(`[NativeReminders:Web Simulation] Hydration reminders active (${count} slots configured).`);
    return { scheduledCount: count, enabled: true };
  }

  try {
    const pending = await LocalNotifications.getPending();
    const hydrationPending = pending.notifications.filter((n) => n.id >= 900000);
    if (hydrationPending.length > 0) {
      await LocalNotifications.cancel({ notifications: hydrationPending });
    }

    const notificationsToSchedule = [];
    const now = new Date();

    // 1. If user configured discrete multi-slot schedules, use those
    const enabledSlots = schedules.filter((s) => s.enabled);
    if (enabledSlots.length > 0) {
      let index = 0;
      for (const slot of enabledSlots) {
        const match = slot.scheduledTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) continue;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const modifier = match[3]?.toUpperCase();
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);

        if (targetDate.getTime() < now.getTime()) {
          targetDate.setDate(targetDate.getDate() + 1);
        }

        const reminderId = 900000 + index;
        notificationsToSchedule.push({
          id: reminderId,
          title: '💧 Hydration Reminder',
          body: `Drink ${slot.amountMl} ml of water to stay hydrated!`,
          schedule: { at: targetDate, allowWhileIdle: true },
          channelId: HYDRATION_NOTIFICATION_CHANNEL,
          actionTypeId: HYDRATION_ACTION_GROUP,
          sound: 'beep.wav',
          extra: {
            type: 'hydration',
            scheduleId: slot.id,
            amountMl: slot.amountMl,
            scheduledTime: slot.scheduledTime,
          },
        });
        index++;
      }
    } else {
      // 2. Fallback: generate interval slots
      const [startH, startM] = (settings.startTime || '08:00').split(':').map(Number);
      const [endH, endM] = (settings.endTime || '20:00').split(':').map(Number);

      const intervalMs = (settings.intervalMinutes || 60) * 60 * 1000;
      const startDate = new Date();
      startDate.setHours(startH, startM, 0, 0);

      const endDate = new Date();
      endDate.setHours(endH, endM, 0, 0);

      let currentTime = startDate.getTime();
      let index = 0;

      while (currentTime <= endDate.getTime() && index < 20) {
        if (currentTime > now.getTime()) {
          const reminderId = 900000 + index;
          notificationsToSchedule.push({
            id: reminderId,
            title: '💧 Time for a Water Break',
            body: `Stay refreshed! Drink a glass of water towards your ${settings.dailyGoalLiters}L daily goal.`,
            schedule: { at: new Date(currentTime), allowWhileIdle: true },
            channelId: HYDRATION_NOTIFICATION_CHANNEL,
            actionTypeId: HYDRATION_ACTION_GROUP,
            sound: 'beep.wav',
            extra: {
              type: 'hydration',
              amountMl: 250,
              scheduledTime: new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          });
        }
        currentTime += intervalMs;
        index++;
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
      console.log(`[NativeReminders] Scheduled ${notificationsToSchedule.length} hydration reminders.`);
    }

    return { scheduledCount: notificationsToSchedule.length, enabled: true };
  } catch (err) {
    console.error('[NativeReminders] Error scheduling hydration reminders:', err);
    return { scheduledCount: 0, enabled: false };
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
