import { Router, Response } from 'express';
import { db } from '../db';
import { AuthenticatedRequest, generateToken, bcrypt, authenticateToken } from '../auth';
import { createConnectionCodeForPatient, getActiveConnectionCode } from '../services/connectionCodeService';

export const authRouter = Router();

function formatUserProfile(userRow: any) {
  if (!userRow) return null;
  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    name: userRow.name,
    age: userRow.age || undefined,
    phone: userRow.phone || undefined,
    avatarUrl: userRow.avatar_url || userRow.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    primaryCaregiver: userRow.primary_caregiver || userRow.primaryCaregiver || undefined,
    caregiverPhone: userRow.caregiver_phone || userRow.caregiverPhone || undefined,
    caregiverEmail: userRow.caregiver_email || userRow.caregiverEmail || undefined,
    emergencyContact: userRow.emergency_contact || userRow.emergencyContact || undefined,
    emergencyPhone: userRow.emergency_phone || userRow.emergencyPhone || undefined,
    quietHours: userRow.quiet_hours || userRow.quietHours || undefined,
  };
}

authRouter.post('/signup', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name, role = 'patient', age, phone, primaryCaregiver, caregiverPhone, caregiverEmail } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const id = `${role === 'caregiver' ? 'c' : 'p'}-${Date.now()}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, age, phone, primary_caregiver, caregiver_phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      email,
      passwordHash,
      role,
      name,
      age || null,
      phone || null,
      primaryCaregiver || null,
      caregiverPhone || null,
      now
    );

    let connectionCode: any = null;

    // If patient: setup default escalation rules & generate unique caregiver connection code
    if (role === 'patient') {
      const defaultLevels = [
        { level: 1, title: 'Level 1: Soft Patient Reminder', target: `${name} (Patient App)`, delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
        { level: 2, title: 'Level 2: Repeated Reminder Tone', target: `${name} (Patient App)`, delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
        { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: primaryCaregiver || 'Caregiver', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver.', enabled: true },
        { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
      ];
      db.prepare(`
        INSERT INTO escalation_rules (id, patient_id, caregiver_name, caregiver_phone, caregiver_email, levels_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`esc-${Date.now()}`, id, primaryCaregiver || null, caregiverPhone || null, caregiverEmail || null, JSON.stringify(defaultLevels), now);

      // Generate unique connection code for the new patient
      connectionCode = createConnectionCodeForPatient(id);
    }

    const token = generateToken({ userId: id, email, role, name });
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    return res.json({ token, user: formatUserProfile(userRow), connectionCode });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

authRouter.post('/login', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

    let connectionCode = null;
    if (user.role === 'patient') {
      connectionCode = getActiveConnectionCode(user.id);
      if (!connectionCode) {
        connectionCode = createConnectionCodeForPatient(user.id);
      }
    }

    return res.json({ token, user: formatUserProfile(user), connectionCode });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let connectionCode = null;
    if (user.role === 'patient') {
      connectionCode = getActiveConnectionCode(user.id);
    }

    return res.json({ user: formatUserProfile(user), connectionCode });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

authRouter.post('/switch-demo', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;
    const targetUserId = role === 'caregiver' ? 'c-1' : 'p-1';
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

    return res.json({ token, user: formatUserProfile(user) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to switch demo user' });
  }
});

