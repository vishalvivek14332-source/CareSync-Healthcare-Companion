import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'caresync-secret-key-2026';

export interface AuthUser {
  userId: string;
  email: string;
  role: 'patient' | 'caregiver';
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (err) {
    return null;
  }
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}

export function requireRole(role: 'patient' | 'caregiver') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.role !== role && req.user.role !== 'caregiver')) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }
    next();
  };
}

export { bcrypt };
