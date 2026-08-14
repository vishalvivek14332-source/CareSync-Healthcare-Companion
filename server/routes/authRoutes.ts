import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  authenticateToken,
  AuthenticatedRequest,
} from '../auth';
import { createConnectionCodeForPatient, getActiveConnectionCode } from '../services/connectionCodeService';

export const authRouter = Router();

// POST /api/auth/signup - Register new Patient or Caregiver
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      role,
      name,
      age,
      phone,
      primaryCaregiver,
      caregiverPhone,
      emergencyContact,
      emergencyPhone,
      quietHours,
      timezone,
    } = req.body;

    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'Email, password, role, and name are required' });
    }

    if (role !== 'patient' && role !== 'caregiver') {
      return res.status(400).json({ error: 'Invalid role. Must be patient or caregiver' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const emailNorm = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `${role === 'patient' ? 'p' : 'c'}-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, age, phone, timezone, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      emailNorm,
      passwordHash,
      role,
      name.trim(),
      age || (role === 'patient' ? 72 : null),
      phone || null,
      timezone || 'UTC',
      primaryCaregiver || null,
      caregiverPhone || null,
      emergencyContact || null,
      emergencyPhone || null,
      quietHours || '10:00 PM - 7:00 AM',
      now
    );

    // If registered as patient, automatically generate a unique CARE-XXXXXX connection code
    let connectionCode: any = null;
    if (role === 'patient') {
      connectionCode = createConnectionCodeForPatient(userId);
    }

    const userPayload = { userId, email: emailNorm, role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = generateRefreshToken(userId, req.headers['user-agent']);

    const userRecord = db.prepare(`
      SELECT id, email, role, name, age, phone, avatar_url as avatarUrl, timezone, primary_caregiver as primaryCaregiver,
             caregiver_phone as caregiverPhone, emergency_contact as emergencyContact,
             emergency_phone as emergencyPhone, quiet_hours as quietHours
      FROM users WHERE id = ?
    `).get(userId) as any;

    return res.status(201).json({
      token: accessToken,
      refreshToken,
      user: userRecord,
      connectionCode,
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error during account creation' });
  }
});

// POST /api/auth/login - Sign in with credentials
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailNorm = email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let connectionCode: any = null;
    if (user.role === 'patient') {
      connectionCode = getActiveConnectionCode(user.id);
      if (!connectionCode) {
        connectionCode = createConnectionCodeForPatient(user.id);
      }
    }

    const userPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = generateRefreshToken(user.id, req.headers['user-agent']);

    const userProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      age: user.age,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      timezone: user.timezone || 'UTC',
      primaryCaregiver: user.primary_caregiver,
      caregiverPhone: user.caregiver_phone,
      emergencyContact: user.emergency_contact,
      emergencyPhone: user.emergency_phone,
      quietHours: user.quiet_hours,
    };

    return res.json({
      token: accessToken,
      refreshToken,
      user: userProfile,
      connectionCode,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during sign in' });
  }
});

// POST /api/auth/refresh - Rotate refresh token & issue new access token
authRouter.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = rotateRefreshToken(refreshToken, req.headers['user-agent']);
    if (!result.success) {
      return res.status(401).json({ error: result.error || 'Invalid refresh token' });
    }

    return res.json({
      token: result.accessToken,
      refreshToken: result.newRefreshToken,
      user: result.user,
    });
  } catch (err: any) {
    console.error('Token refresh error:', err);
    return res.status(500).json({ error: 'Failed to refresh authentication session' });
  }
});

// POST /api/auth/logout - Revoke active refresh token
authRouter.post('/logout', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Logout error' });
  }
});

// GET /api/auth/me - Fetch authenticated user profile
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = db.prepare(`
      SELECT id, email, role, name, age, phone, avatar_url as avatarUrl, timezone, primary_caregiver as primaryCaregiver,
             caregiver_phone as caregiverPhone, emergency_contact as emergencyContact,
             emergency_phone as emergencyPhone, quiet_hours as quietHours
      FROM users WHERE id = ?
    `).get(req.user!.userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    let connectionCode: any = null;
    if (user.role === 'patient') {
      connectionCode = getActiveConnectionCode(user.id);
      if (!connectionCode) {
        connectionCode = createConnectionCodeForPatient(user.id);
      }
    }

    return res.json({
      user,
      connectionCode,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// POST /api/auth/switch-demo - Switch between demo accounts for evaluation
authRouter.post('/switch-demo', (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const targetId = role === 'caregiver' ? 'c-1' : 'p-1';
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Demo user not seeded' });
    }

    const userPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = generateRefreshToken(user.id, 'Demo Switcher');

    const userProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      age: user.age,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      timezone: user.timezone || 'UTC',
      primaryCaregiver: user.primary_caregiver,
      caregiverPhone: user.caregiver_phone,
      emergencyContact: user.emergency_contact,
      emergencyPhone: user.emergency_phone,
      quietHours: user.quiet_hours,
    };

    return res.json({
      token: accessToken,
      refreshToken,
      user: userProfile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to switch demo user' });
  }
});
