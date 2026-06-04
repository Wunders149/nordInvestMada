import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const router = Router();

// ─── In-memory session store ───
const sessions = new Map();

// ─── Helpers ───
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return data.trim() ? JSON.parse(data) : [];
  } catch { return []; }
}

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ─── Auth Middleware ───
function requireAuth(req, res, next) {
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

// ─── LOGIN ───
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'nordinvest2026';

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    username,
    expires: Date.now() + 24 * 60 * 60 * 1000 // 24h
  });

  res.json({ success: true, token });
});

// ─── LOGOUT ───
router.post('/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers.authorization.slice(7));
  res.json({ success: true });
});

// ─── CONTACTS ───
router.get('/contacts', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'contacts.json');
  const contacts = readJSON(filePath);
  // Sort newest first
  contacts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(contacts);
});

router.patch('/contacts/:id', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'contacts.json');
  const contacts = readJSON(filePath);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact non trouvé' });

  if (req.body.read !== undefined) contacts[idx].read = req.body.read;
  if (req.body.resolved !== undefined) contacts[idx].resolved = req.body.resolved;
  if (req.body.notes !== undefined) contacts[idx].notes = req.body.notes;

  writeJSON(filePath, contacts);
  res.json({ success: true, contact: contacts[idx] });
});

router.delete('/contacts/:id', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'contacts.json');
  let contacts = readJSON(filePath);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact non trouvé' });
  contacts.splice(idx, 1);
  writeJSON(filePath, contacts);
  res.json({ success: true });
});

// ─── QUOTES ───
router.get('/quotes', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'quotes.json');
  const quotes = readJSON(filePath);
  quotes.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(quotes);
});

router.patch('/quotes/:id', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'quotes.json');
  const quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });

  if (req.body.status !== undefined) quotes[idx].status = req.body.status;
  if (req.body.notes !== undefined) quotes[idx].notes = req.body.notes;

  writeJSON(filePath, quotes);
  res.json({ success: true, quote: quotes[idx] });
});

router.delete('/quotes/:id', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'quotes.json');
  let quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
  quotes.splice(idx, 1);
  writeJSON(filePath, quotes);
  res.json({ success: true });
});

// ─── SUBSCRIBERS ───
router.get('/subscribers', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'subscribers.json');
  const subscribers = readJSON(filePath);
  subscribers.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(subscribers);
});

router.delete('/subscribers/:email', requireAuth, (req, res) => {
  const filePath = path.join(projectRoot, 'data', 'subscribers.json');
  let subscribers = readJSON(filePath);
  const idx = subscribers.findIndex(s => s.email === req.params.email);
  if (idx === -1) return res.status(404).json({ error: 'Abonné non trouvé' });
  subscribers.splice(idx, 1);
  writeJSON(filePath, subscribers);
  res.json({ success: true });
});

// ─── STATS ───
router.get('/stats', requireAuth, (req, res) => {
  const contactsPath = path.join(projectRoot, 'data', 'contacts.json');
  const quotesPath = path.join(projectRoot, 'data', 'quotes.json');
  const subscribersPath = path.join(projectRoot, 'data', 'subscribers.json');

  const contacts = readJSON(contactsPath);
  const quotes = readJSON(quotesPath);
  const subscribers = readJSON(subscribersPath);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  res.json({
    totalContacts: contacts.length,
    unreadContacts: contacts.filter(c => !c.read).length,
    totalQuotes: quotes.length,
    pendingQuotes: quotes.filter(q => q.status === 'pending' || !q.status).length,
    totalSubscribers: subscribers.length,
    contactsThisMonth: contacts.filter(c => new Date(c.date) >= new Date(today.getFullYear(), today.getMonth(), 1)).length,
    lastUpdate: new Date().toISOString()
  });
});

export { router as adminRouter, escapeHtml };
