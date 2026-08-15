package com.caresync.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

@CapacitorPlugin(name = "CareSyncNativeAlarm")
public class CareSyncAlarmPlugin extends Plugin {
    private static final String TAG = "CareSyncAlarmPlugin";

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            int id = call.getInt("id", (int) (System.currentTimeMillis() % 100000));
            String type = call.getString("type", "medication");
            String title = call.getString("title", "CareSync Alarm");
            String body = call.getString("body", "Health reminder scheduled.");
            long triggerTime = call.getLong("triggerTime", 0L);
            JSObject extraObj = call.getObject("extra", new JSObject());

            if (triggerTime <= 0) {
                call.reject("triggerTime (epoch milliseconds) must be provided");
                return;
            }

            CareSyncAlarmScheduler.scheduleAlarm(
                    getContext(),
                    id,
                    type,
                    title,
                    body,
                    triggerTime,
                    extraObj.toString()
            );

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            ret.put("triggerTime", triggerTime);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm error: " + e.getMessage(), e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            int id = call.getInt("id", -1);
            if (id != -1) {
                CareSyncAlarmScheduler.cancelAlarm(getContext(), id);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAllAlarms(PluginCall call) {
        try {
            CareSyncAlarmScheduler.cancelAllAlarms(getContext());
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingAlarms(PluginCall call) {
        try {
            List<CareSyncAlarmScheduler.AlarmItem> alarms = CareSyncAlarmScheduler.getAllSavedAlarms(getContext());
            JSArray array = new JSArray();
            for (CareSyncAlarmScheduler.AlarmItem item : alarms) {
                JSObject obj = new JSObject();
                obj.put("id", item.id);
                obj.put("type", item.type);
                obj.put("title", item.title);
                obj.put("body", item.body);
                obj.put("triggerTime", item.triggerTime);
                obj.put("extra", new JSObject(item.extraJson));
                array.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("alarms", array);
            ret.put("count", alarms.size());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        boolean canScheduleExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                canScheduleExact = alarmManager.canScheduleExactAlarms();
            }
        }
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean fullScreenAllowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ (API 34)
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                fullScreenAllowed = nm.canUseFullScreenIntent();
            }
        }

        JSObject ret = new JSObject();
        ret.put("canScheduleExactAlarms", canScheduleExact);
        ret.put("notificationsEnabled", notificationsEnabled);
        ret.put("fullScreenIntentAllowed", fullScreenAllowed);
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } else {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingActions(PluginCall call) {
        try {
            JSONArray actions = CareSyncAlarmScheduler.getAndClearOfflineActions(getContext());
            JSArray retArray = new JSArray();
            for (int i = 0; i < actions.length(); i++) {
                retArray.put(new JSObject(actions.getJSONObject(i).toString()));
            }
            JSObject ret = new JSObject();
            ret.put("actions", retArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            NotificationManagerCompat nmc = NotificationManagerCompat.from(ctx);

            boolean exactAlarms = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am != null) {
                exactAlarms = am.canScheduleExactAlarms();
            }

            boolean ignoringBattery = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                ignoringBattery = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            }

            boolean fullScreenAllowed = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    fullScreenAllowed = nm.canUseFullScreenIntent();
                }
            }

            List<CareSyncAlarmScheduler.AlarmItem> alarms = CareSyncAlarmScheduler.getAllSavedAlarms(ctx);

            JSObject ret = new JSObject();
            ret.put("notificationPermission", nmc.areNotificationsEnabled() ? "GRANTED" : "DENIED");
            ret.put("exactAlarmPermission", exactAlarms ? "GRANTED" : "DENIED");
            ret.put("fullScreenIntentPermission", fullScreenAllowed ? "GRANTED" : "DENIED");
            ret.put("batteryOptimization", ignoringBattery ? "IGNORED" : "OPTIMIZED");
            ret.put("pendingAlarmsCount", alarms.size());
            ret.put("sdkVersion", Build.VERSION.SDK_INT);
            ret.put("backendUrl", "https://caresync-backend-zobp.onrender.com");

            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
