import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { requireAuth, loginLimiter, sessions, logActivity, writeJSON, readJSON } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');

const router = Router();

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ─── LOGIN ───
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'nordinvest2026';

  if (username !== adminUser || password !== adminPass) {
    logActivity('login_failed', `Tentative de connexion échouée pour: ${username}`);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    username,
    expires: Date.now() + 24 * 60 * 60 * 1000
  });

  logActivity('login', `Connexion réussie`, username);
  res.json({ success: true, token });
});

// ─── LOGOUT ───
router.post('/logout', requireAuth, (req, res) => {
  logActivity('logout', `Déconnexion`, req.admin.username);
  sessions.delete(req.headers.authorization.slice(7));
  res.json({ success: true });
});

// ─── CONTACTS ───
router.get('/contacts', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'contacts.json');
  const contacts = readJSON(filePath);
  contacts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(contacts);
});

router.patch('/contacts/:id', requireAuth, async (req, res) => {
  const filePath = path.join(dataDir, 'contacts.json');
  const contacts = readJSON(filePath);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact non trouvé' });

  if (req.body.read !== undefined) contacts[idx].read = req.body.read;
  if (req.body.resolved !== undefined) contacts[idx].resolved = req.body.resolved;
  if (req.body.notes !== undefined) contacts[idx].notes = req.body.notes;

  await writeJSON(filePath, contacts);
  logActivity('contact_update', `Contact ${req.params.id} mis à jour`, req.admin.username);
  res.json({ success: true, contact: contacts[idx] });
});

router.delete('/contacts/:id', requireAuth, async (req, res) => {
  const filePath = path.join(dataDir, 'contacts.json');
  let contacts = readJSON(filePath);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact non trouvé' });
  const removed = contacts.splice(idx, 1);
  await writeJSON(filePath, contacts);
  logActivity('contact_delete', `Contact supprimé: ${removed[0]?.name || req.params.id}`, req.admin.username);
  res.json({ success: true });
});

// ─── QUOTES ───
router.get('/quotes', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  const quotes = readJSON(filePath);
  quotes.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(quotes);
});

router.patch('/quotes/:id', requireAuth, async (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  const quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });

  if (req.body.status !== undefined) quotes[idx].status = req.body.status;
  if (req.body.notes !== undefined) quotes[idx].notes = req.body.notes;

  await writeJSON(filePath, quotes);
  logActivity('quote_update', `Devis ${req.params.id} mis à jour (statut: ${req.body.status})`, req.admin.username);
  res.json({ success: true, quote: quotes[idx] });
});

router.delete('/quotes/:id', requireAuth, async (req, res) => {
  const filePath = path.join(dataDir, 'quotes.json');
  let quotes = readJSON(filePath);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Devis non trouvé' });
  const removed = quotes.splice(idx, 1);
  await writeJSON(filePath, quotes);
  logActivity('quote_delete', `Devis supprimé: ${removed[0]?.quoteNumber || req.params.id}`, req.admin.username);
  res.json({ success: true });
});

// ─── SUBSCRIBERS ───
router.get('/subscribers', requireAuth, (req, res) => {
  const filePath = path.join(dataDir, 'subscribers.json');
  const subscribers = readJSON(filePath);
  subscribers.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(subscribers);
});

router.delete('/subscribers/:email', requireAuth, async (req, res) => {
  const filePath = path.join(dataDir, 'subscribers.json');
  let subscribers = readJSON(filePath);
  const idx = subscribers.findIndex(s => s.email === req.params.email);
  if (idx === -1) return res.status(404).json({ error: 'Abonné non trouvé' });
  subscribers.splice(idx, 1);
  await writeJSON(filePath, subscribers);
  logActivity('subscriber_delete', `Abonné supprimé: ${req.params.email}`, req.admin.username);
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

// ─── ACTIVITY LOG ───
router.get('/activity', requireAuth, (req, res) => {
  const logPath = path.join(dataDir, 'activity.json');
  const logs = readJSON(logPath);
  res.json(Array.isArray(logs) ? logs.slice(0, 100) : []);
});

// ─── GENERIC CRUD HELPER ───
function crudRoutes(entityName, fileName) {
  const filePath = () => path.join(dataDir, fileName);

  router.get(`/${entityName}`, requireAuth, (req, res) => {
    const items = readJSON(filePath());
    items.sort((a, b) => (a.order || 99) - (b.order || 99));
    res.json(items);
  });

  router.post(`/${entityName}`, requireAuth, async (req, res) => {
    const items = readJSON(filePath());
    const newItem = {
      id: `${entityName.slice(0, -1)}_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    await writeJSON(filePath(), items);
    logActivity(`${entityName}_create`, `${entityName.slice(0, -1)} créé: ${newItem.name || newItem.title || newItem.id}`, req.admin.username);
    res.json({ success: true, item: newItem });
  });

  router.patch(`/${entityName}/:id`, requireAuth, async (req, res) => {
    const items = readJSON(filePath());
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    Object.assign(items[idx], req.body);
    items[idx].updatedAt = new Date().toISOString();
    await writeJSON(filePath(), items);
    logActivity(`${entityName}_update`, `${entityName.slice(0, -1)} modifié: ${items[idx].name || items[idx].title || req.params.id}`, req.admin.username);
    res.json({ success: true, item: items[idx] });
  });

  router.delete(`/${entityName}/:id`, requireAuth, async (req, res) => {
    let items = readJSON(filePath());
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const removed = items.splice(idx, 1);
    await writeJSON(filePath(), items);
    logActivity(`${entityName}_delete`, `${entityName.slice(0, -1)} supprimé: ${removed[0]?.name || removed[0]?.title || req.params.id}`, req.admin.username);
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

router.put('/pricing', requireAuth, async (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  let cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const validCategories = ['construction', 'rehabilitation', 'forage'];
  const incoming = req.body;

  for (const cat of validCategories) {
    if (incoming[cat]) {
      for (const tier of Object.keys(incoming[cat])) {
        const t = incoming[cat][tier];
        if (typeof t.name !== 'string' || !t.name.trim()) {
          return res.status(400).json({ error: `Le champ "name" est requis pour ${cat}/${tier}` });
        }
        if (cat === 'forage') {
          if (tier === 'standard' && (typeof t.pricePerML !== 'number' || t.pricePerML <= 0)) {
            return res.status(400).json({ error: `Prix invalide pour ${cat}/${tier}` });
          }
          if (tier !== 'standard' && (typeof t.price !== 'number' || t.price <= 0)) {
            return res.status(400).json({ error: `Prix invalide pour ${cat}/${tier}` });
          }
        } else {
          if (typeof t.pricePerM2 !== 'number' || t.pricePerM2 <= 0) {
            return res.status(400).json({ error: `Prix invalide pour ${cat}/${tier}` });
          }
        }
        if (!Array.isArray(t.features)) {
          return res.status(400).json({ error: `"features" doit être un tableau pour ${cat}/${tier}` });
        }
      }
    }
  }

  cfg.pricing = incoming;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  logActivity('pricing_update', 'Grille tarifaire mise à jour', req.admin.username);
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

router.put('/contact-info', requireAuth, async (req, res) => {
  const configPath = path.join(projectRoot, 'config.json');
  let cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (req.body.contact) cfg.contact = req.body.contact;
  if (req.body.social) cfg.social = req.body.social;
  if (req.body.mission) cfg.mission = req.body.mission;
  if (req.body.vision) cfg.vision = req.body.vision;
  if (req.body.team) cfg.team = req.body.team;
  if (req.body.experience_years) cfg.experience_years = req.body.experience_years;
  if (req.body.founded) cfg.founded = req.body.founded;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  logActivity('contact_info_update', 'Informations de contact mises à jour', req.admin.username);
  res.json({ success: true });
});

// ─── SITE SETTINGS ───
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

router.put('/settings', requireAuth, async (req, res) => {
  const settingsPath = path.join(projectRoot, 'data', 'settings.json');
  await writeJSON(settingsPath, req.body);
  logActivity('settings_update', 'Paramètres du site mis à jour', req.admin.username);
  res.json({ success: true });
});

// ─── EMAIL TEST ───
router.post('/test-email', requireAuth, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Email destinataire requis' });

  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Test — Nord Invest Madagascar',
      html: `<h2>Test d'envoi d'email</h2><p>Cet email confirme que votre configuration SMTP fonctionne correctement.</p><p><small>${new Date().toISOString()}</small></p>`
    });
    logActivity('email_test', `Email test envoyé à ${to}`, req.admin.username);
    res.json({ success: true, message: 'Email test envoyé avec succès' });
  } catch (err) {
    logActivity('email_test_failed', `Échec envoi test à ${to}: ${err.message}`, req.admin.username);
    res.status(500).json({ error: `Échec: ${err.message}` });
  }
});

export { router as adminRouter };
