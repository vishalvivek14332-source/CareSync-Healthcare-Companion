package com.caresync.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class CareSyncAlarmScheduler {
    private static final String TAG = "CareSyncAlarmScheduler";
    private static final String PREFS_NAME = "caresync_alarm_prefs";
    private static final String KEY_SCHEDULED_ALARMS = "scheduled_alarms";
    public static final String KEY_OFFLINE_ACTIONS = "offline_actions";

    public static class AlarmItem {
        public int id;
        public String type; // "medication" | "hydration"
        public String title;
        public String body;
        public long triggerTime;
        public String extraJson;

        public JSONObject toJson() {
            try {
                JSONObject json = new JSONObject();
                json.put("id", id);
                json.put("type", type);
                json.put("title", title);
                json.put("body", body);
                json.put("triggerTime", triggerTime);
                json.put("extraJson", extraJson);
                return json;
            } catch (Exception e) {
                return new JSONObject();
            }
        }

        public static AlarmItem fromJson(JSONObject json) {
            try {
                AlarmItem item = new AlarmItem();
                item.id = json.optInt("id");
                item.type = json.optString("type", "medication");
                item.title = json.optString("title", "CareSync Reminder");
                item.body = json.optString("body", "");
                item.triggerTime = json.optLong("triggerTime", 0);
                item.extraJson = json.optString("extraJson", "{}");
                return item;
            } catch (Exception e) {
                return null;
            }
        }
    }

    public static synchronized void scheduleAlarm(
            Context context,
            int alarmId,
            String type,
            String title,
            String body,
            long triggerTime,
            String extraJson
    ) {
        if (triggerTime <= System.currentTimeMillis()) {
            Log.w(TAG, "Trigger time is in the past for alarmId " + alarmId + ", ignoring.");
            return;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager service not available");
            return;
        }

        Intent intent = new Intent(context, CareSyncAlarmReceiver.class);
        intent.setAction("com.caresync.app.TRIGGER_ALARM");
        intent.putExtra("alarmId", alarmId);
        intent.putExtra("type", type);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("triggerTime", triggerTime);
        intent.putExtra("extraJson", extraJson);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, alarmId, intent, flags);

        // Main app launch intent for AlarmClockInfo
        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                alarmId + 500000,
                showIntent,
                flags
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerTime, showPendingIntent);
                alarmManager.setAlarmClock(clockInfo, pendingIntent);
                Log.i(TAG, "⏰ Scheduled AlarmClock for id=" + alarmId + " (" + type + ") at " + triggerTime + " [Exact Priority]");
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                Log.i(TAG, "⏰ Scheduled setExactAndAllowWhileIdle for id=" + alarmId + " at " + triggerTime);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                Log.i(TAG, "⏰ Scheduled setExact for id=" + alarmId + " at " + triggerTime);
            }

            // Persist alarm item in SharedPreferences
            AlarmItem item = new AlarmItem();
            item.id = alarmId;
            item.type = type;
            item.title = title;
            item.body = body;
            item.triggerTime = triggerTime;
            item.extraJson = extraJson;
            saveAlarmItem(context, item);

        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException scheduling exact alarm. SCHEDULE_EXACT_ALARM permission needed: " + se.getMessage());
            // Fallback
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule alarm: " + e.getMessage(), e);
        }
    }

    public static synchronized void cancelAlarm(Context context, int alarmId) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                Intent intent = new Intent(context, CareSyncAlarmReceiver.class);
                intent.setAction("com.caresync.app.TRIGGER_ALARM");
                int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
                PendingIntent pendingIntent = PendingIntent.getBroadcast(context, alarmId, intent, flags);
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            }
            removeAlarmItem(context, alarmId);
            Log.i(TAG, "Cancelled alarm id=" + alarmId);
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling alarm: " + e.getMessage());
        }
    }

    public static synchronized void cancelAllAlarms(Context context) {
        List<AlarmItem> alarms = getAllSavedAlarms(context);
        for (AlarmItem a : alarms) {
            cancelAlarm(context, a.id);
        }
        clearAllSavedAlarms(context);
    }

    public static synchronized void saveAlarmItem(Context context, AlarmItem item) {
        List<AlarmItem> list = getAllSavedAlarms(context);
        // Remove existing item with same id
        list.removeIf(a -> a.id == item.id);
        list.add(item);
        persistAlarmList(context, list);
    }

    public static synchronized void removeAlarmItem(Context context, int alarmId) {
        List<AlarmItem> list = getAllSavedAlarms(context);
        boolean changed = list.removeIf(a -> a.id == alarmId);
        if (changed) {
            persistAlarmList(context, list);
        }
    }

    public static synchronized List<AlarmItem> getAllSavedAlarms(Context context) {
        List<AlarmItem> result = new ArrayList<>();
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_SCHEDULED_ALARMS, "[]");
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                AlarmItem item = AlarmItem.fromJson(obj);
                if (item != null) {
                    result.add(item);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading saved alarms: " + e.getMessage());
        }
        return result;
    }

    private static void persistAlarmList(Context context, List<AlarmItem> list) {
        try {
            JSONArray array = new JSONArray();
            for (AlarmItem item : list) {
                array.put(item.toJson());
            }
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_SCHEDULED_ALARMS, array.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error persisting alarms: " + e.getMessage());
        }
    }

    public static synchronized void clearAllSavedAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_SCHEDULED_ALARMS).apply();
    }

    public static synchronized void recordOfflineAction(Context context, String type, String endpoint, String payloadJson) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_OFFLINE_ACTIONS, "[]");
            JSONArray array = new JSONArray(raw);

            JSONObject action = new JSONObject();
            action.put("id", "native-" + System.currentTimeMillis());
            action.put("type", type);
            action.put("endpoint", endpoint);
            action.put("payload", new JSONObject(payloadJson));
            action.put("timestamp", System.currentTimeMillis());

            array.put(action);
            prefs.edit().putString(KEY_OFFLINE_ACTIONS, array.toString()).apply();
            Log.i(TAG, "Recorded offline action: " + type + " -> " + endpoint);
        } catch (Exception e) {
            Log.e(TAG, "Error recording offline action: " + e.getMessage());
        }
    }

    public static synchronized JSONArray getAndClearOfflineActions(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_OFFLINE_ACTIONS, "[]");
            JSONArray array = new JSONArray(raw);
            prefs.edit().remove(KEY_OFFLINE_ACTIONS).apply();
            return array;
        } catch (Exception e) {
            return new JSONArray();
        }
    }
}
