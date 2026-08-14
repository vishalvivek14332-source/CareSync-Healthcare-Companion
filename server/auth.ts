import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './config';
import { queryRow, executeSql } from './db';

export interface UserPayload {
  userId: string;
  email: string;
  role: 'patient' | 'caregiver';
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// -----------------------------------------------------------------------------
// JWT ACCESS TOKEN GENERATION (Short-lived: 15 minutes)
// -----------------------------------------------------------------------------
export function generateAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

// -----------------------------------------------------------------------------
// REFRESH TOKEN GENERATION & HASHED DATABASE PERSISTENCE (30 days validity)
// -----------------------------------------------------------------------------
export async function generateRefreshToken(userId: string, deviceInfo?: string): Promise<{ refreshToken: string; expiresAt: string }> {
  // 32-byte cryptographically random token
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const id = `rt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  await executeSql(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, device_info, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, userId, tokenHash, deviceInfo || 'CareSync Client', expiresAt, now]);

  return { refreshToken, expiresAt };
}

// -----------------------------------------------------------------------------
// REFRESH TOKEN ROTATION (Rotates token and detects replay attacks)
// -----------------------------------------------------------------------------
export async function rotateRefreshToken(
  providedRefreshToken: string,
  deviceInfo?: string
): Promise<{ success: boolean; accessToken?: string; newRefreshToken?: string; user?: UserPayload; error?: string }> {
  if (!providedRefreshToken || typeof providedRefreshToken !== 'string') {
    return { success: false, error: 'Refresh token is required' };
  }

  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');

  // Look up token record in database
  const record = await queryRow<any>('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);

  if (!record) {
    return { success: false, error: 'Invalid refresh token' };
  }

  const now = new Date().toISOString();

  // REPLAY ATTACK DETECTION: If token was already revoked, revoke all tokens for this user
  if (record.revoked_at) {
    console.warn(`🚨 [Security Warning] Replay of revoked refresh token detected for user ${record.user_id}! Revoking all active sessions.`);
    await executeSql('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ?', [now, record.user_id]);
    return { success: false, error: 'Compromised token detected. Session revoked.' };
  }

  // Check expiration
  if (new Date(record.expires_at) < new Date()) {
    await executeSql('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [now, record.id]);
    return { success: false, error: 'Refresh token expired. Please sign in again.' };
  }

  // Revoke current refresh token
  await executeSql('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [now, record.id]);

  // Fetch active user profile
  const user = await queryRow<any>('SELECT id, email, role FROM users WHERE id = ?', [record.user_id]);
  if (!user) {
    return { success: false, error: 'User account not found' };
  }

  const userPayload: UserPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  // Issue new Access Token (15m) and new Refresh Token (30d)
  const newAccessToken = generateAccessToken(userPayload);
  const { refreshToken: newRefreshToken } = await generateRefreshToken(user.id, deviceInfo);

  return {
    success: true,
    accessToken: newAccessToken,
    newRefreshToken,
    user: userPayload,
  };
}

// -----------------------------------------------------------------------------
// REVOKE REFRESH TOKEN (Logout)
// -----------------------------------------------------------------------------
export async function revokeRefreshToken(providedRefreshToken: string): Promise<boolean> {
  if (!providedRefreshToken) return false;
  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
  const now = new Date().toISOString();
  const res = await executeSql('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?', [now, tokenHash]);
  return res.changes > 0;
}

// -----------------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// -----------------------------------------------------------------------------
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, config.jwtAccessSecret, (err: any, user: any) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid or malformed authentication token', code: 'TOKEN_INVALID' });
    }
    req.user = user as UserPayload;
    next();
  });
}
