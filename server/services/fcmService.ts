import { queryRow, queryRows, executeSql } from '../db';
import { config } from '../config';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Register or update device push token for authenticated user
export async function registerDevicePushToken(userId: string, token: string, platform: string = 'android') {
  if (!userId || !token) return;
  const now = new Date().toISOString();
  const id = `tok-${Date.now()}-${token.substring(0, 8)}`;

  // Upsert token
  const existing = await queryRow<any>('SELECT id FROM device_push_tokens WHERE token = ?', [token]);
  if (existing) {
    await executeSql('UPDATE device_push_tokens SET user_id = ?, platform = ?, updated_at = ? WHERE id = ?', [
      userId,
      platform,
      now,
      existing.id,
    ]);
  } else {
    await executeSql(`
      INSERT INTO device_push_tokens (id, user_id, token, platform, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, token, platform, now, now]);
  }
}

// Remove invalid or unregistered token
export async function removeDevicePushToken(token: string) {
  if (!token) return;
  await executeSql('DELETE FROM device_push_tokens WHERE token = ?', [token]);
}

// Dispatch push notification to all active devices of a user
export async function sendUserPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sentCount: number; failureCount: number }> {
  const tokens = await queryRows<{ token: string }>('SELECT token FROM device_push_tokens WHERE user_id = ?', [userId]);

  if (tokens.length === 0) {
    // No registered push tokens for user
    return { sentCount: 0, failureCount: 0 };
  }

  if (!config.fcmServerKey) {
    // Development / Simulation Mode: Log simulated push dispatch
    console.log(`📡 [FCM Simulation] Sent push to ${tokens.length} device(s) for User ${userId}: "${payload.title}" - ${payload.body}`);
    return { sentCount: tokens.length, failureCount: 0 };
  }

  let sentCount = 0;
  let failureCount = 0;

  for (const { token } of tokens) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${config.fcmServerKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: payload.title,
            body: payload.body,
            sound: 'default',
            click_action: 'FCM_PLUGIN_ACTIVITY',
          },
          data: payload.data || {},
          priority: 'high',
        }),
      });

      const resData: any = await response.json().catch(() => ({}));
      if (resData?.failure === 1 && resData?.results?.[0]?.error === 'NotRegistered') {
        await removeDevicePushToken(token);
        failureCount++;
      } else if (response.ok) {
        sentCount++;
      } else {
        failureCount++;
      }
    } catch (err) {
      failureCount++;
    }
  }

  return { sentCount, failureCount };
}
