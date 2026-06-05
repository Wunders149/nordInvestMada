import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');

export const sessions = new Map();

const locks = new Map();
const lockQueue = new Map();

export function requireAuth(req, res, next) {
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

export async function acquireLock(filePath) {
  const normalized = path.resolve(filePath);
  while (locks[normalized]) {
    await new Promise(resolve => {
      if (!lockQueue[normalized]) lockQueue[normalized] = [];
      lockQueue[normalized].push(resolve);
    });
  }
  locks[normalized] = true;
}

export function releaseLock(filePath) {
  const normalized = path.resolve(filePath);
  delete locks[normalized];
  if (lockQueue[normalized] && lockQueue[normalized].length > 0) {
    const next = lockQueue[normalized].shift();
    if (next) next();
    if (lockQueue[normalized].length === 0) delete lockQueue[normalized];
  }
}

export async function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await acquireLock(filePath);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } finally {
    releaseLock(filePath);
  }
}

export function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return data.trim() ? JSON.parse(data) : [];
  } catch { return []; }
}

export function logActivity(action, details, username) {
  try {
    const logPath = path.join(dataDir, 'activity.json');
    let logs = readJSON(logPath);
    if (!Array.isArray(logs)) logs = [];
    logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      username: username || 'admin',
      timestamp: new Date().toISOString()
    });
    if (logs.length > 500) logs = logs.slice(0, 500);
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.warn('Activity log write failed:', err.message);
  }
}

export function checkDefaultCredentials() {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    console.warn('⚠  ADMIN_USER or ADMIN_PASS not set in .env! Using defaults. Set them in production.');
  }
  if (user === 'admin' && pass === 'nordinvest2026') {
    console.warn('⚠  Using default admin credentials (admin/nordinvest2026). Change them in .env for production.');
  }
}
