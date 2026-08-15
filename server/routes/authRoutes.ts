import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryRow, queryRows, executeSql } from '../db';
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  authenticateToken,
  AuthenticatedRequest,
} from '../auth';
import {
  createConnectionCodeForPatient,
  getActiveConnectionCode,
  redeemConnectionCode,
  hashCode,
} from '../services/connectionCodeService';

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
      connectionCode: inputConnectionCode,
      linkCode,
      code,
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
    const existing = await queryRow('SELECT id FROM users WHERE email = ?', [emailNorm]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists' });
    }

    // Caretaker Onboarding: Pre-validate patient connection code if provided
    let cleanCode = '';
    if (role === 'caregiver') {
      const rawCode = inputConnectionCode || linkCode || code;
      if (rawCode && typeof rawCode === 'string' && rawCode.trim()) {
        cleanCode = rawCode.trim().toUpperCase();
        const codeHash = hashCode(cleanCode);
        const nowIso = new Date().toISOString();

        const codeRecord = await queryRow<any>(`
          SELECT c.*, u.id as "patientId", u.name as "patientName"
          FROM care_connection_codes c
          JOIN users u ON c.patient_id = u.id
          WHERE (c.code_hash = ? OR c.code_display = ?)
            AND c.revoked_at IS NULL
            AND c.expires_at > ?
        `, [codeHash, cleanCode, nowIso]);

        if (!codeRecord) {
          return res.status(400).json({
            error: 'Invalid, expired, or revoked patient connection code. Please check the code provided by the patient.',
          });
        }
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `${role === 'patient' ? 'p' : 'c'}-${Date.now()}`;
    const now = new Date().toISOString();

    await executeSql(`
      INSERT INTO users (id, email, password_hash, role, name, age, phone, timezone, primary_caregiver, caregiver_phone, emergency_contact, emergency_phone, quiet_hours, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
      now,
    ]);

    // If registered as patient, automatically generate a unique CARE-XXXXXX connection code
    let connectionCode: any = null;
    let linkedPatient: any = null;

    if (role === 'patient') {
      connectionCode = await createConnectionCodeForPatient(userId);
    } else if (role === 'caregiver' && cleanCode) {
      // Establish caregiver <-> patient link using existing connection-code service
      const redeemResult = await redeemConnectionCode(userId, cleanCode);
      if (!redeemResult.success) {
        // Rollback user creation if redeem failed
        await executeSql('DELETE FROM users WHERE id = ?', [userId]);
        return res.status(400).json({
          error: redeemResult.error || 'Failed to establish caretaker relationship with patient',
        });
      }
      linkedPatient = redeemResult.patient;
    }

    const userPayload = { userId, email: emailNorm, role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = await generateRefreshToken(userId, req.headers['user-agent']);

    const userRecord = await queryRow(`
      SELECT id, email, role, name, age, phone, avatar_url as "avatarUrl", timezone, primary_caregiver as "primaryCaregiver",
             caregiver_phone as "caregiverPhone", emergency_contact as "emergencyContact",
             emergency_phone as "emergencyPhone", quiet_hours as "quietHours"
      FROM users WHERE id = ?
    `, [userId]);

    return res.status(201).json({
      token: accessToken,
      refreshToken,
      user: userRecord,
      connectionCode,
      linkedPatient,
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
    const user = await queryRow<any>('SELECT * FROM users WHERE email = ?', [emailNorm]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let connectionCode: any = null;
    if (user.role === 'patient') {
      connectionCode = await getActiveConnectionCode(user.id);
      if (!connectionCode) {
        connectionCode = await createConnectionCodeForPatient(user.id);
      }
    }

    const userPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = await generateRefreshToken(user.id, req.headers['user-agent']);

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
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await rotateRefreshToken(refreshToken, req.headers['user-agent']);
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
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Logout error' });
  }
});

// GET /api/auth/me - Fetch authenticated user profile
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await queryRow(`
      SELECT id, email, role, name, age, phone, avatar_url as "avatarUrl", timezone, primary_caregiver as "primaryCaregiver",
             caregiver_phone as "caregiverPhone", emergency_contact as "emergencyContact",
             emergency_phone as "emergencyPhone", quiet_hours as "quietHours"
      FROM users WHERE id = ?
    `, [req.user!.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    let connectionCode: any = null;
    if (user.role === 'patient') {
      connectionCode = await getActiveConnectionCode(user.id);
      if (!connectionCode) {
        connectionCode = await createConnectionCodeForPatient(user.id);
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
authRouter.post('/switch-demo', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const targetId = role === 'caregiver' ? 'c-1' : 'p-1';
    const user = await queryRow<any>('SELECT * FROM users WHERE id = ?', [targetId]);

    if (!user) {
      return res.status(404).json({ error: 'Demo user not seeded' });
    }

    const userPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(userPayload);
    const { refreshToken } = await generateRefreshToken(user.id, 'Demo Switcher');

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
