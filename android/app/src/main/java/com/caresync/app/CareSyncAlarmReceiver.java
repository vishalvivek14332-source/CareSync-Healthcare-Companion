package com.caresync.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class CareSyncAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "CareSyncAlarmReceiver";
    public static final String CHANNEL_MEDICATION = "medication-alarms-v3";
    public static final String CHANNEL_HYDRATION = "hydration-alarms-v3";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "🔔 CareSyncAlarmReceiver onReceive() - Alarm Triggered!");

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "caresync:alarm_wakelock"
            );
            wakeLock.acquire(60 * 1000L); // Hold CPU awake for 60 seconds
        }

        try {
            int alarmId = intent.getIntExtra("alarmId", (int) (System.currentTimeMillis() % 100000));
            String type = intent.getStringExtra("type");
            if (type == null) type = "medication";
            String title = intent.getStringExtra("title");
            if (title == null) title = "CareSync Alarm";
            String body = intent.getStringExtra("body");
            if (body == null) body = "Scheduled health reminder.";
            String extraJson = intent.getStringExtra("extraJson");
            if (extraJson == null) extraJson = "{}";

            boolean isMed = "medication".equalsIgnoreCase(type);
            String channelId = isMed ? CHANNEL_MEDICATION : CHANNEL_HYDRATION;

            // 1. Create Channels with USAGE_ALARM
            createNotificationChannels(context);

            // 2. Sound URI for raw/beep.wav
            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + R.raw.beep);

            // 3. Full-Screen PendingIntent targeting CareSyncAlarmActivity
            Intent fullScreenIntent = new Intent(context, CareSyncAlarmActivity.class);
            fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            fullScreenIntent.putExtra("alarmId", alarmId);
            fullScreenIntent.putExtra("type", type);
            fullScreenIntent.putExtra("title", title);
            fullScreenIntent.putExtra("body", body);
            fullScreenIntent.putExtra("extraJson", extraJson);

            int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    context,
                    alarmId + 100000,
                    fullScreenIntent,
                    pFlags
            );

            // 4. Action Intents for Notification Buttons
            Intent confirmIntent = new Intent(context, CareSyncActionReceiver.class);
            confirmIntent.setAction(isMed ? "com.caresync.app.ACTION_TAKEN" : "com.caresync.app.ACTION_DRANK");
            confirmIntent.putExtra("alarmId", alarmId);
            confirmIntent.putExtra("type", type);
            confirmIntent.putExtra("extraJson", extraJson);
            PendingIntent confirmPendingIntent = PendingIntent.getBroadcast(
                    context,
                    alarmId + 200000,
                    confirmIntent,
                    pFlags
            );

            Intent snoozeIntent = new Intent(context, CareSyncActionReceiver.class);
            snoozeIntent.setAction("com.caresync.app.ACTION_SNOOZE");
            snoozeIntent.putExtra("alarmId", alarmId);
            snoozeIntent.putExtra("type", type);
            snoozeIntent.putExtra("title", title);
            snoozeIntent.putExtra("body", body);
            snoozeIntent.putExtra("extraJson", extraJson);
            PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                    context,
                    alarmId + 300000,
                    snoozeIntent,
                    pFlags
            );

            Intent dismissIntent = new Intent(context, CareSyncActionReceiver.class);
            dismissIntent.setAction("com.caresync.app.ACTION_DISMISS");
            dismissIntent.putExtra("alarmId", alarmId);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                    context,
                    alarmId + 400000,
                    dismissIntent,
                    pFlags
            );

            long[] vibrationPattern = new long[]{0, 600, 300, 600, 300, 800};

            // 5. Build Alarm Notification with CATEGORY_ALARM, MAX PRIORITY & FULL SCREEN INTENT
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setSound(soundUri)
                    .setVibrate(vibrationPattern)
                    .setContentIntent(fullScreenPendingIntent)
                    .setFullScreenIntent(fullScreenPendingIntent, true)
                    .setAutoCancel(false)
                    .setOngoing(true)
                    .addAction(
                            R.mipmap.ic_launcher,
                            isMed ? "✓ Confirm Taken" : "✓ Log Drank",
                            confirmPendingIntent
                    )
                    .addAction(
                            R.mipmap.ic_launcher,
                            "⏰ Snooze 10m",
                            snoozePendingIntent
                    )
                    .addAction(
                            R.mipmap.ic_launcher,
                            "✕ Dismiss",
                            dismissPendingIntent
                    );

            Notification notification = builder.build();
            notification.flags |= Notification.FLAG_INSISTENT;

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify(alarmId, notification);
            Log.i(TAG, "📢 Posted High-Priority FullScreen Alarm Notification id=" + alarmId + " (" + type + ")");

            // 6. Direct FullScreen Activity Launch
            try {
                context.startActivity(fullScreenIntent);
                Log.i(TAG, "🚀 Direct CareSyncAlarmActivity launched from receiver to wake screen immediately");
            } catch (Exception ae) {
                Log.w(TAG, "Direct activity launch fallback: " + ae.getMessage());
            }

            // Remove one-shot item from scheduled storage
            CareSyncAlarmScheduler.removeAlarmItem(context, alarmId);

        } catch (Exception e) {
            Log.e(TAG, "Error in CareSyncAlarmReceiver: " + e.getMessage(), e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;

            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + R.raw.beep);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            // Medication Channel (v3)
            NotificationChannel medChannel = new NotificationChannel(
                    CHANNEL_MEDICATION,
                    "Medication Alarms",
                    NotificationManager.IMPORTANCE_HIGH
            );
            medChannel.setDescription("High-priority medication alarms that wake screen and sound audio");
            medChannel.setSound(soundUri, audioAttributes);
            medChannel.enableVibration(true);
            medChannel.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 800});
            medChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            medChannel.setBypassDnd(true);
            manager.createNotificationChannel(medChannel);

            // Hydration Channel (v3)
            NotificationChannel hydChannel = new NotificationChannel(
                    CHANNEL_HYDRATION,
                    "Hydration Alarms",
                    NotificationManager.IMPORTANCE_HIGH
            );
            hydChannel.setDescription("High-priority water intake alarms and hydration reminders");
            hydChannel.setSound(soundUri, audioAttributes);
            hydChannel.enableVibration(true);
            hydChannel.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 800});
            hydChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            hydChannel.setBypassDnd(true);
            manager.createNotificationChannel(hydChannel);

            Log.i(TAG, "Created notification channels: " + CHANNEL_MEDICATION + ", " + CHANNEL_HYDRATION);
        }
    }
}
