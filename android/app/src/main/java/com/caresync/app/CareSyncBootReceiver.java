package com.caresync.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import java.util.List;

public class CareSyncBootReceiver extends BroadcastReceiver {
    private static final String TAG = "CareSyncBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.i(TAG, "🔄 Device boot / update event received: " + action);

        List<CareSyncAlarmScheduler.AlarmItem> alarms = CareSyncAlarmScheduler.getAllSavedAlarms(context);
        long now = System.currentTimeMillis();
        int restoredCount = 0;

        for (CareSyncAlarmScheduler.AlarmItem item : alarms) {
            long trigger = item.triggerTime;
            // If trigger was in the past while phone was off, trigger 15 seconds after boot
            if (trigger <= now) {
                trigger = now + (15 * 1000L);
            }

            CareSyncAlarmScheduler.scheduleAlarm(
                    context,
                    item.id,
                    item.type,
                    item.title,
                    item.body,
                    trigger,
                    item.extraJson
            );
            restoredCount++;
        }

        Log.i(TAG, "✅ Successfully restored " + restoredCount + " alarms after boot.");
    }
}
