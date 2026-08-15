package com.caresync.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

public class CareSyncActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CareSyncActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        int alarmId = intent.getIntExtra("alarmId", 0);
        String type = intent.getStringExtra("type");
        if (type == null) type = "medication";
        String title = intent.getStringExtra("title");
        if (title == null) title = "CareSync Alarm";
        String body = intent.getStringExtra("body");
        if (body == null) body = "";
        String extraJson = intent.getStringExtra("extraJson");
        if (extraJson == null) extraJson = "{}";

        Log.i(TAG, "🎯 CareSyncActionReceiver action=" + action + " for alarmId=" + alarmId);

        // 1. Cancel active notification
        if (alarmId > 0) {
            NotificationManagerCompat.from(context).cancel(alarmId);
        }

        if ("com.caresync.app.ACTION_SNOOZE".equals(action)) {
            long snoozeTime = System.currentTimeMillis() + (10 * 60 * 1000); // 10 minutes
            int snoozeId = (int) (System.currentTimeMillis() % 800000) + 100000;
            CareSyncAlarmScheduler.scheduleAlarm(
                    context,
                    snoozeId,
                    type,
                    "⏰ " + title + " (Snoozed)",
                    body,
                    snoozeTime,
                    extraJson
            );
            Log.i(TAG, "⏰ Snoozed alarm " + alarmId + " -> New AlarmId " + snoozeId + " for +10m");

        } else if ("com.caresync.app.ACTION_TAKEN".equals(action)) {
            try {
                JSONObject extra = new JSONObject(extraJson);
                String medId = extra.optString("medicationId", "m-1");
                String payload = new JSONObject()
                        .put("status", "taken")
                        .put("takenAt", new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.US).format(new java.util.Date()))
                        .toString();

                CareSyncAlarmScheduler.recordOfflineAction(
                        context,
                        "log_medication",
                        "/api/medications/" + medId + "/log",
                        payload
                );
                Log.i(TAG, "✓ Recorded TAKEN action for medication " + medId);
            } catch (Exception e) {
                Log.e(TAG, "Error recording TAKEN action: " + e.getMessage());
            }

        } else if ("com.caresync.app.ACTION_DRANK".equals(action)) {
            try {
                JSONObject extra = new JSONObject(extraJson);
                int amountMl = extra.optInt("amountMl", 250);
                String payload = new JSONObject()
                        .put("amountMl", amountMl)
                        .toString();

                CareSyncAlarmScheduler.recordOfflineAction(
                        context,
                        "log_hydration",
                        "/api/hydration/log",
                        payload
                );
                Log.i(TAG, "✓ Recorded DRANK action for " + amountMl + " ml");
            } catch (Exception e) {
                Log.e(TAG, "Error recording DRANK action: " + e.getMessage());
            }
        } else if ("com.caresync.app.ACTION_DISMISS".equals(action)) {
            Log.i(TAG, "✕ Dismissed alarm " + alarmId);
        }
    }
}
