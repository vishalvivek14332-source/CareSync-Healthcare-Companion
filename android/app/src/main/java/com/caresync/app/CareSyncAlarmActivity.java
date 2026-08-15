package com.caresync.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CareSyncAlarmActivity extends Activity {
    private static final String TAG = "CareSyncAlarmActivity";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private int alarmId;
    private String type = "medication";
    private String title = "Medication Reminder";
    private String body = "Time for your scheduled dose.";
    private String extraJson = "{}";

    private String medicationName = "";
    private String dosage = "";
    private String instructions = "";
    private String scheduledTimeStr = "";
    private int amountMl = 250;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "🚀 CareSyncAlarmActivity launched successfully");

        // 1. Configure Window Flags to Turn Screen On and Show Over Lock Screen
        configureLockScreen();

        setContentView(R.layout.activity_alarm);

        // 2. Parse Intent Extras & Payload
        parseAlarmData(getIntent());

        // 3. Populate Native Views
        populateUI();

        // 4. Start Native Alarm Audio & Vibration
        startAlarmSound();
        startVibration();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        parseAlarmData(intent);
        populateUI();
    }

    private void configureLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        }
        Log.d(TAG, "Screen-on & show-when-locked flags configured");
    }

    private void parseAlarmData(Intent intent) {
        if (intent == null) return;
        alarmId = intent.getIntExtra("alarmId", (int) (System.currentTimeMillis() % 100000));
        type = intent.getStringExtra("type");
        if (type == null) type = "medication";
        title = intent.getStringExtra("title");
        body = intent.getStringExtra("body");
        extraJson = intent.getStringExtra("extraJson");
        if (extraJson == null) extraJson = "{}";

        try {
            JSONObject extra = new JSONObject(extraJson);
            medicationName = extra.optString("medicationName", "");
            dosage = extra.optString("dosage", "");
            instructions = extra.optString("instructions", "");
            scheduledTimeStr = extra.optString("scheduledTime", "");
            amountMl = extra.optInt("amountMl", 250);
            if (extra.has("type")) {
                type = extra.optString("type", type);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not parse extraJson: " + e.getMessage());
        }

        Log.d(TAG, "Alarm Data parsed: id=" + alarmId + ", type=" + type + ", name=" + medicationName + ", dose=" + dosage + ", time=" + scheduledTimeStr);
    }

    private void populateUI() {
        TextView tvBadge = findViewById(R.id.tvAlarmBadge);
        TextView tvTime = findViewById(R.id.tvAlarmTime);
        TextView tvStatus = findViewById(R.id.tvAlarmStatus);
        TextView tvTitle = findViewById(R.id.tvAlarmTitle);
        TextView tvBody = findViewById(R.id.tvAlarmBody);
        Button btnConfirm = findViewById(R.id.btnConfirm);
        Button btnSnooze = findViewById(R.id.btnSnooze);
        Button btnDismiss = findViewById(R.id.btnDismiss);

        boolean isMed = "medication".equalsIgnoreCase(type);

        tvBadge.setText(isMed ? "MEDICATION REMINDER" : "HYDRATION REMINDER");

        String displayTime = scheduledTimeStr.isEmpty()
                ? new SimpleDateFormat("hh:mm a", Locale.US).format(new Date())
                : scheduledTimeStr;
        tvTime.setText(displayTime);

        if (isMed) {
            tvStatus.setText("It's time for your scheduled medication.");
            String mainName = medicationName.isEmpty() ? (title != null && !title.isEmpty() ? title : "Prescribed Medication") : medicationName;
            tvTitle.setText(mainName);

            StringBuilder details = new StringBuilder();
            if (!dosage.isEmpty()) details.append(dosage);
            if (!instructions.isEmpty()) {
                if (details.length() > 0) details.append(" • ");
                details.append(instructions);
            }
            if (details.length() == 0) {
                details.append(body != null && !body.isEmpty() ? body : "Take with water as prescribed.");
            }
            tvBody.setText(details.toString());

            btnConfirm.setText("✓ CONFIRM TAKEN");
        } else {
            tvStatus.setText("Stay hydrated! It's time for a water break.");
            tvTitle.setText("Water Break (" + amountMl + " mL)");
            tvBody.setText("Drink " + amountMl + " mL of water to reach your daily hydration goal.");
            btnConfirm.setText("✓ LOG DRANK");
        }

        btnConfirm.setOnClickListener(v -> {
            Log.d(TAG, "Action selected: CONFIRM (" + (isMed ? "TAKEN" : "DRANK") + ")");
            stopAlarmSound();
            Intent actionIntent = new Intent(this, CareSyncActionReceiver.class);
            actionIntent.setAction(isMed ? "com.caresync.app.ACTION_TAKEN" : "com.caresync.app.ACTION_DRANK");
            actionIntent.putExtra("alarmId", alarmId);
            actionIntent.putExtra("type", type);
            actionIntent.putExtra("extraJson", extraJson);
            sendBroadcast(actionIntent);

            NotificationManagerCompat.from(this).cancel(alarmId);
            finishAndRemoveTaskSafe();
        });

        btnSnooze.setOnClickListener(v -> {
            Log.d(TAG, "Action selected: SNOOZE 10m");
            stopAlarmSound();
            Intent actionIntent = new Intent(this, CareSyncActionReceiver.class);
            actionIntent.setAction("com.caresync.app.ACTION_SNOOZE");
            actionIntent.putExtra("alarmId", alarmId);
            actionIntent.putExtra("type", type);
            actionIntent.putExtra("title", title);
            actionIntent.putExtra("body", body);
            actionIntent.putExtra("extraJson", extraJson);
            sendBroadcast(actionIntent);

            NotificationManagerCompat.from(this).cancel(alarmId);
            finishAndRemoveTaskSafe();
        });

        btnDismiss.setOnClickListener(v -> {
            Log.d(TAG, "Action selected: DISMISS");
            stopAlarmSound();
            Intent actionIntent = new Intent(this, CareSyncActionReceiver.class);
            actionIntent.setAction("com.caresync.app.ACTION_DISMISS");
            actionIntent.putExtra("alarmId", alarmId);
            sendBroadcast(actionIntent);

            NotificationManagerCompat.from(this).cancel(alarmId);
            finishAndRemoveTaskSafe();
        });
    }

    private void startAlarmSound() {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int curVol = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                Log.d(TAG, "Alarm stream volume=" + curVol + "/" + maxVol);
            }

            // 1. Create MediaPlayer from R.raw.beep
            mediaPlayer = MediaPlayer.create(this, R.raw.beep);
            if (mediaPlayer == null) {
                Log.w(TAG, "MediaPlayer.create(R.raw.beep) returned null, trying alarm ringtone fallback");
                Uri fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (fallbackUri == null) fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                mediaPlayer = MediaPlayer.create(this, fallbackUri);
            }

            if (mediaPlayer != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    mediaPlayer.setAudioAttributes(audioAttributes);
                } else {
                    mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                mediaPlayer.setLooping(true);
                mediaPlayer.setVolume(1.0f, 1.0f);
                mediaPlayer.start();
                Log.d(TAG, "🔊 MediaPlayer started successfully with USAGE_ALARM");
            } else {
                Log.e(TAG, "MediaPlayer creation failed completely");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start alarm sound: " + e.getMessage(), e);
        }
    }

    private void startVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 600, 400, 600, 400, 800};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = repeat continuously
                } else {
                    vibrator.vibrate(pattern, 0);
                }
                Log.d(TAG, "📳 Repeating vibration started");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration: " + e.getMessage());
        }
    }

    private synchronized void stopAlarmSound() {
        Log.d(TAG, "Stopping alarm sound & vibration");
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
                Log.d(TAG, "MediaPlayer stopped and released");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping media player: " + e.getMessage());
        }

        try {
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
                Log.d(TAG, "Vibrator cancelled");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error cancelling vibration: " + e.getMessage());
        }
    }

    private void finishAndRemoveTaskSafe() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    @Override
    protected void onStop() {
        stopAlarmSound();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        stopAlarmSound();
        super.onDestroy();
        Log.d(TAG, "CareSyncAlarmActivity onDestroy()");
    }
}
