import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { supabase, logActivity as dbLogActivity } from './supabase.js';

export const sessions = new Map();

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const token = authHeader.slice(7);
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expirée' });
  }
  req.admin = session;
  next();
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

export async function loginUser(username, password) {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash')
      .eq('username', username)
      .single();

    if (error || !data) return null;

    const match = await bcrypt.compare(password, data.password_hash);
    if (!match) return null;

    return { id: data.id, username: data.username };
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function logActivity(action, details, username) {
  dbLogActivity(action, details, username);
}
