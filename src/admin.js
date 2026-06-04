import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');

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
  const filePath = path.join(dataDir, 'contacts.json');
  const contacts = readJSON(filePath);
  // Sort newest first
  contacts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(contacts);
});

router.patch('/contacts/:id', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'contacts.json');
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
  const filePath = path.join(dataDir, 'contacts.json');
  let contacts = readJSON(filePath);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact non trouvé' });
  contacts.splice(idx, 1);
  writeJSON(filePath, contacts);
  res.json({ success: true });
});

// ─── QUOTES ───
router.get('/quotes', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  const quotes = readJSON(filePath);
  quotes.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(quotes);
});

router.patch('/quotes/:id', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  const quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });

  if (req.body.status !== undefined) quotes[idx].status = req.body.status;
  if (req.body.notes !== undefined) quotes[idx].notes = req.body.notes;

  writeJSON(filePath, quotes);
  res.json({ success: true, quote: quotes[idx] });
});

router.delete('/quotes/:id', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  let quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
  quotes.splice(idx, 1);
  writeJSON(filePath, quotes);
  res.json({ success: true });
});

// ─── SUBSCRIBERS ───
router.get('/subscribers', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'subscribers.json');
  const subscribers = readJSON(filePath);
  subscribers.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(subscribers);
});

router.delete('/subscribers/:email', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'subscribers.json');
  let subscribers = readJSON(filePath);
  const idx = subscribers.findIndex(s => s.email === req.params.email);
  if (idx === -1) return res.status(404).json({ error: 'Abonné non trouvé' });
  subscribers.splice(idx, 1);
  writeJSON(filePath, subscribers);
  res.json({ success: true });
});

// ─── STATS ───
router.get('/stats', requireAuth, (req, res) => {
  const contactsPath = path.join(dataDir, 'contacts.json');
  const quotesPath = path.join(dataDir, 'quotes.json');
  const subscribersPath = path.join(dataDir, 'subscribers.json');

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

// ─── GENERIC CRUD HELPER ───
function crudRoutes(entityName, fileName) {
  const filePath = () => path.join(dataDir, fileName);

  // LIST
  router.get(`/${entityName}`, requireAuth, (req, res) => {
    const items = readJSON(filePath());
    items.sort((a, b) => (a.order || 99) - (b.order || 99));
    res.json(items);
  });

  // CREATE
  router.post(`/${entityName}`, requireAuth, (req, res) => {
    const items = readJSON(filePath());
    const newItem = {
      id: `${entityName.slice(0, -1)}_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    writeJSON(filePath(), items);
    res.json({ success: true, item: newItem });
  });

  // UPDATE
  router.patch(`/${entityName}/:id`, requireAuth, (req, res) => {
    const items = readJSON(filePath());
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    Object.assign(items[idx], req.body);
    items[idx].updatedAt = new Date().toISOString();
    writeJSON(filePath(), items);
    res.json({ success: true, item: items[idx] });
  });

  // DELETE
  router.delete(`/${entityName}/:id`, requireAuth, (req, res) => {
    let items = readJSON(filePath());
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    items.splice(idx, 1);
    writeJSON(filePath(), items);
    res.json({ success: true });
  });
}

crudRoutes('team', 'team.json');
crudRoutes('services', 'services.json');
crudRoutes('projects', 'projects.json');
crudRoutes('blog', 'blog.json');

// ─── PRICING MANAGEMENT ───
router.get('/pricing', requireAuth, (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json(cfg.pricing || {});
});

router.put('/pricing', requireAuth, (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  let cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cfg.pricing = req.body;
  writeJSON(configPath, cfg);
  res.json({ success: true });
});

// ─── CONTACT INFO ───
router.get('/contact-info', requireAuth, (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json({
    contact: cfg.contact || {},
    social: cfg.social || {},
    mission: cfg.mission || '',
    vision: cfg.vision || '',
    team: cfg.team || {},
    founded: cfg.founded || 2015,
    experience_years: cfg.experience_years || 10
  });
});

router.put('/contact-info', requireAuth, (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  let cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (req.body.contact) cfg.contact = req.body.contact;
  if (req.body.social) cfg.social = req.body.social;
  if (req.body.mission) cfg.mission = req.body.mission;
  if (req.body.vision) cfg.vision = req.body.vision;
  if (req.body.team) cfg.team = req.body.team;
  if (req.body.experience_years) cfg.experience_years = req.body.experience_years;
  if (req.body.founded) cfg.founded = req.body.founded;
  writeJSON(configPath, cfg);
  res.json({ success: true });
});

// ─── SITE SETTINGS (meta, GA, WhatsApp) ───
router.get('/settings', requireAuth, (req, res) => {
  const settingsPath = path.join(projectRoot, 'data', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    return res.json({
      googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || 'G-XXXXXXXXXX',
      whatsappNumber: '261328231280',
      siteUrl: process.env.SITE_URL || 'https://nordinvest.mg',
      seoDescription: "Nord Invest Madagascar — Immobilier & Construction à Antsiranana. Expertise en bâtiment, forage, réhabilitation et vente immobilière.",
      seoKeywords: ["immobilier", "construction", "madagascar", "antsiranana", "diego-suarez", "forage", "réhabilitation"]
    });
  }
  res.json(readJSON(settingsPath));
});

router.put('/settings', requireAuth, (req, res) => {
  const settingsPath = path.join(projectRoot, 'data', 'settings.json');
  writeJSON(settingsPath, req.body);
  res.json({ success: true });
});

export { router as adminRouter, escapeHtml, requireAuth, sessions };
