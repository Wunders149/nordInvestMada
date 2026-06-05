import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase, logActivity as dbLogActivity } from './supabase.js';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const sessionCache = new Map();

let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - SESSION_DURATION_MS).toISOString();
      await supabase.from('sessions').delete().lt('expires', cutoff);
    } catch (err) {
      console.warn('Session cleanup error:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);
}

async function loadSession(token) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('token, user_id, username, expires')
      .eq('token', token)
      .single();
    if (error || !data) return null;
    const expires = new Date(data.expires).getTime();
    if (expires < Date.now()) {
      await supabase.from('sessions').delete().eq('token', token);
      return null;
    }
    return { username: data.username, userId: data.user_id, expires };
  } catch {
    return null;
  }
}

export async function createSession(user) {
  startCleanup();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const session = { token, user_id: user.id, username: user.username, expires };

  try {
    await supabase.from('sessions').insert(session);
  } catch (err) {
    console.warn('Session DB write failed, using memory-only:', err.message);
  }

  const cacheEntry = { username: user.username, userId: user.id, expires: new Date(expires).getTime() };
  sessionCache.set(token, cacheEntry);
  return token;
}

export async function destroySession(token) {
  sessionCache.delete(token);
  try {
    await supabase.from('sessions').delete().eq('token', token);
  } catch (err) {
    console.warn('Session DB delete failed:', err.message);
  }
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const token = authHeader.slice(7);

  let session = sessionCache.get(token);
  if (session && session.expires < Date.now()) {
    sessionCache.delete(token);
    session = null;
  }
  if (!session) {
    session = await loadSession(token);
    if (session) {
      sessionCache.set(token, session);
    }
  }
  if (!session) {
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
