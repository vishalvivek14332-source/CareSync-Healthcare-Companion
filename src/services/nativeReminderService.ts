import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { logMedicationDoseApi, logHydrationApi, queueOfflineAction } from './api';
import { Medication, HydrationSchedule, HydrationSettings } from '../types';

export const MEDICATION_ACTION_GROUP = 'MEDICATION_ALARM_ACTIONS';
export const HYDRATION_ACTION_GROUP = 'HYDRATION_ALARM_ACTIONS';
export const HYDRATION_NOTIFICATION_CHANNEL = 'hydration-alarms-v2';
export const MEDICATION_NOTIFICATION_CHANNEL = 'medication-alarms-v2';

export interface CareSyncNativeAlarmPlugin {
  scheduleAlarm(options: {
    id: number;
    type: 'medication' | 'hydration';
    title: string;
    body: string;
    triggerTime: number; // epoch ms
    extra?: any;
  }): Promise<{ success: boolean; id: number; triggerTime: number }>;

  cancelAlarm(options: { id: number }): Promise<{ success: boolean }>;
  cancelAllAlarms(): Promise<{ success: boolean }>;
  getPendingAlarms(): Promise<{ alarms: any[]; count: number }>;
  checkExactAlarmPermission(): Promise<{ canScheduleExactAlarms: boolean; notificationsEnabled: boolean; sdkInt: number }>;
  openExactAlarmSettings(): Promise<{ success: boolean }>;
  getPendingActions(): Promise<{ actions: Array<{ id: string; type: string; endpoint: string; payload: any; timestamp: number }> }>;
  getDiagnostics(): Promise<{
    notificationPermission: string;
    exactAlarmPermission: string;
    batteryOptimization: string;
    pendingAlarmsCount: number;
    sdkVersion: number;
    backendUrl: string;
  }>;
}

export const CareSyncNativeAlarm = registerPlugin<CareSyncNativeAlarmPlugin>('CareSyncNativeAlarm');

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
 * Initialize native Android Alarm channels, permissions, and sync pending actions from background alarms.
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
    // 1. Request POST_NOTIFICATIONS runtime permission on Android 13+
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 2. Check Exact Alarm Permission
    try {
      const exactPerm = await CareSyncNativeAlarm.checkExactAlarmPermission();
      console.log('[NativeReminders] Exact alarm permission status:', exactPerm);
    } catch (e) {
      console.warn('[NativeReminders] CareSyncNativeAlarm plugin check skipped:', e);
    }

    // 3. Process any offline actions completed while app was closed
    await syncNativePendingActions();

    // 4. Register Action Listener if LocalNotifications fires
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('[NativeReminders] Foreground notification received:', notification);
      const extra = notification.extra || {};
      if (onAlarmTriggeredHandler) {
        onAlarmTriggeredHandler({
          id: String(notification.id),
          type: extra.type || 'medication',
          title: notification.title,
          subtitle: notification.body,
          scheduledTime: extra.scheduledTime || 'Now',
          dosageOrAmount: extra.dosage || (extra.amountMl ? `${extra.amountMl} ml` : 'Prescribed dose'),
          instructions: extra.instructions,
          extra,
        });
      }
    });

    isInitialized = true;
    console.log('[NativeReminders] CareSync Native Android Alarm System initialized.');
  } catch (err) {
    console.error('[NativeReminders] Error initializing native alarms:', err);
  }
}

/**
 * Syncs any actions recorded natively by CareSyncActionReceiver while the app was closed.
 */
export async function syncNativePendingActions() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const res = await CareSyncNativeAlarm.getPendingActions();
    if (res && res.actions && res.actions.length > 0) {
      console.log(`[NativeReminders] Found ${res.actions.length} pending native actions to sync:`, res.actions);
      for (const act of res.actions) {
        if (act.type === 'log_medication') {
          const medId = act.endpoint.split('/')[3] || 'm-1';
          try {
            await logMedicationDoseApi(medId, 'taken', act.payload?.takenAt);
            if (onDoseConfirmedHandler) onDoseConfirmedHandler(medId);
          } catch {
            queueOfflineAction({ type: 'log_medication', endpoint: act.endpoint, payload: act.payload });
          }
        } else if (act.type === 'log_hydration') {
          const amount = act.payload?.amountMl || 250;
          try {
            await logHydrationApi(amount);
            if (onWaterConfirmedHandler) onWaterConfirmedHandler(amount);
          } catch {
            queueOfflineAction({ type: 'log_hydration', endpoint: act.endpoint, payload: act.payload });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[NativeReminders] Could not retrieve pending native actions:', err);
  }
}

/**
 * Schedule an exact native Android AlarmManager alarm.
 */
export async function scheduleNativeMedicationAlarm(
  medicationId: string,
  medicationName: string,
  dosage: string,
  scheduledTime: Date,
  instructions?: string
) {
  const triggerTime = scheduledTime.getTime();
  const notificationId = 100000 + (Math.abs(hashCode(`${medicationId}_${triggerTime}`)) % 799999);

  if (!Capacitor.isNativePlatform()) {
    console.log(`[NativeReminders:Web Simulation] Native reminder set for ${medicationName} at ${scheduledTime.toLocaleTimeString()}`);
    return;
  }

  try {
    // 1. Schedule via dedicated Native Android AlarmManager Plugin
    await CareSyncNativeAlarm.scheduleAlarm({
      id: notificationId,
      type: 'medication',
      title: '🔔 Medication Alarm',
      body: `💊 ${medicationName} (${dosage}) is scheduled now.`,
      triggerTime,
      extra: {
        medicationId,
        medicationName,
        dosage,
        instructions,
        scheduledTime: scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'medication',
      },
    });

    console.log(`[NativeReminders] Scheduled exact AlarmClock for ${medicationName} at ${scheduledTime.toLocaleTimeString()} (id: ${notificationId})`);
  } catch (err) {
    console.error('[NativeReminders] Error scheduling native medication alarm:', err);
  }
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
        await CareSyncNativeAlarm.cancelAllAlarms();
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
 */
export async function syncNativeHydrationReminders(
  settings: HydrationSettings,
  userRole: 'patient' | 'caregiver' = 'patient',
  schedules: HydrationSchedule[] = []
) {
  if (userRole !== 'patient' || !settings.reminderEnabled) {
    return { scheduledCount: 0, enabled: false };
  }

  if (!Capacitor.isNativePlatform()) {
    const count = schedules.length > 0 ? schedules.filter((s) => s.enabled).length : 8;
    console.log(`[NativeReminders:Web Simulation] Hydration reminders active (${count} slots configured).`);
    return { scheduledCount: count, enabled: true };
  }

  try {
    const now = new Date();
    const enabledSlots = schedules.filter((s) => s.enabled);
    let count = 0;

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
        await CareSyncNativeAlarm.scheduleAlarm({
          id: reminderId,
          type: 'hydration',
          title: '💧 Hydration Alarm',
          body: `Drink ${slot.amountMl} ml of water to reach your hydration goal!`,
          triggerTime: targetDate.getTime(),
          extra: {
            type: 'hydration',
            scheduleId: slot.id,
            amountMl: slot.amountMl,
            scheduledTime: slot.scheduledTime,
          },
        });
        index++;
        count++;
      }
    } else {
      // Interval fallback
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
          await CareSyncNativeAlarm.scheduleAlarm({
            id: reminderId,
            type: 'hydration',
            title: '💧 Time for a Water Break',
            body: `Stay refreshed! Drink a glass of water towards your ${settings.dailyGoalLiters}L daily goal.`,
            triggerTime: currentTime,
            extra: {
              type: 'hydration',
              amountMl: 250,
              scheduledTime: new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          });
          count++;
        }
        currentTime += intervalMs;
        index++;
      }
    }

    console.log(`[NativeReminders] Scheduled ${count} native hydration alarms.`);
    return { scheduledCount: count, enabled: true };
  } catch (err) {
    console.error('[NativeReminders] Error scheduling hydration alarms:', err);
    return { scheduledCount: 0, enabled: false };
  }
}

/**
 * Diagnostic helper to get Android alarm status for UI
 */
export async function getNativeAlarmDiagnostics() {
  if (!Capacitor.isNativePlatform()) {
    return {
      notificationPermission: 'GRANTED (Web)',
      exactAlarmPermission: 'NOT_APPLICABLE (Web)',
      batteryOptimization: 'NOT_APPLICABLE',
      pendingAlarmsCount: 0,
      sdkVersion: 0,
      backendUrl: 'https://caresync-backend-zobp.onrender.com',
    };
  }
  try {
    return await CareSyncNativeAlarm.getDiagnostics();
  } catch {
    return {
      notificationPermission: 'UNKNOWN',
      exactAlarmPermission: 'UNKNOWN',
      batteryOptimization: 'UNKNOWN',
      pendingAlarmsCount: 0,
      sdkVersion: 0,
      backendUrl: 'https://caresync-backend-zobp.onrender.com',
    };
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
