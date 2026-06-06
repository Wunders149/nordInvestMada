import { Router } from 'express';
import { requireAuth, loginLimiter, createSession, destroySession, loginUser, hashPassword, logActivity } from './auth.js';
import { supabase, list, get, create, update, remove, getSiteConfig, upsertSiteConfig, getSetting, setSetting, getAllSettings } from './supabase.js';
import { validate, loginSchema } from './validation.js';
import crypto from 'crypto';

const router = Router();

const FIELD_MAP = {
  imageSlot: 'image_slot'
};

function mapFields(body, direction = 'toDb') {
  if (direction === 'toDb') {
    const result = {};
    for (const [key, value] of Object.entries(body)) {
      result[FIELD_MAP[key] || key] = value;
    }
    return result;
  }
  const rev = {};
  for (const [k, v] of Object.entries(FIELD_MAP)) { rev[v] = k; }
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    result[rev[key] || key] = value;
  }
  return result;
}

function camelizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ─── LOGIN ───
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  const user = await loginUser(username, password);
  if (!user) {
    logActivity('login_failed', `Tentative de connexion échouée pour: ${username}`);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
  const token = await createSession(user);
  logActivity('login', `Connexion réussie`, user.username);
  res.json({ success: true, token });
});

// ─── LOGOUT ───
router.post('/logout', requireAuth, async (req, res) => {
  logActivity('logout', `Déconnexion`, req.admin.username);
  await destroySession(req.headers.authorization.slice(7));
  res.json({ success: true });
});

// ─── CONTACTS ───
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = await list('contacts', { order: [['date', 'desc']] });
    res.json(contacts.map(c => camelizeKeys(c)));
  } catch (err) {
    console.error('Contacts list error:', err);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

router.patch('/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contact = await update('contacts', req.params.id, {
      read: req.body.read !== undefined ? req.body.read : undefined,
      resolved: req.body.resolved !== undefined ? req.body.resolved : undefined,
      notes: req.body.notes !== undefined ? req.body.notes : undefined
    });
    logActivity('contact_update', `Contact ${req.params.id} mis à jour`, req.admin.username);
    res.json({ success: true, contact });
  } catch (err) {
    console.error('Contact update error:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contact = await get('contacts', req.params.id);
    await remove('contacts', req.params.id);
    logActivity('contact_delete', `Contact supprimé: ${contact?.name || req.params.id}`, req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Contact delete error:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ─── QUOTES ───
router.get('/quotes', requireAuth, async (req, res) => {
  try {
    const quotes = await list('quotes', { order: [['date', 'desc']] });
    res.json(quotes.map(q => camelizeKeys(q)));
  } catch (err) {
    console.error('Quotes list error:', err);
    res.status(500).json({ error: 'Failed to load quotes' });
  }
});

router.patch('/quotes/:id', requireAuth, async (req, res) => {
  try {
    const quote = await update('quotes', req.params.id, {
      status: req.body.status !== undefined ? req.body.status : undefined,
      notes: req.body.notes !== undefined ? req.body.notes : undefined
    });
    logActivity('quote_update', `Devis ${req.params.id} mis à jour (statut: ${req.body.status})`, req.admin.username);
    res.json({ success: true, quote });
  } catch (err) {
    console.error('Quote update error:', err);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

router.delete('/quotes/:id', requireAuth, async (req, res) => {
  try {
    const quote = await get('quotes', req.params.id);
    await remove('quotes', req.params.id);
    logActivity('quote_delete', `Devis supprimé: ${quote?.quoteNumber || req.params.id}`, req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Quote delete error:', err);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// ─── SUBSCRIBERS ───
router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    const subscribers = await list('subscribers', { order: [['date', 'desc']] });
    res.json(subscribers);
  } catch (err) {
    console.error('Subscribers list error:', err);
    res.status(500).json({ error: 'Failed to load subscribers' });
  }
});

router.delete('/subscribers/:email', requireAuth, async (req, res) => {
  try {
    const sub = await get('subscribers', req.params.email, 'email');
    if (!sub) return res.status(404).json({ error: 'Abonné non trouvé' });
    await remove('subscribers', req.params.email, 'email');
    logActivity('subscriber_delete', `Abonné supprimé: ${req.params.email}`, req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Subscriber delete error:', err);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// ─── STATS ───
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
    const { count: unreadContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('read', false);
    const { count: totalQuotes } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
    const { count: pendingQuotes } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['pending', null]);
    const { count: totalSubscribers } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: contactsThisMonth } = await supabase.from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('date', firstOfMonth);

    res.json({
      totalContacts: totalContacts || 0,
      unreadContacts: unreadContacts || 0,
      totalQuotes: totalQuotes || 0,
      pendingQuotes: pendingQuotes || 0,
      totalSubscribers: totalSubscribers || 0,
      contactsThisMonth: contactsThisMonth || 0,
      lastUpdate: new Date().toISOString()
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ─── ACTIVITY LOG ───
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const logs = await list('activity_logs', { order: [['timestamp', 'desc']], limit: 100 });
    res.json(logs);
  } catch (err) {
    console.error('Activity log error:', err);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// ─── GENERIC CRUD HELPER ───
function crudRoutes(entityName, tableName, orderOption = [['order', 'asc']]) {
  router.get(`/${entityName}`, requireAuth, async (req, res) => {
    try {
      const items = await list(tableName, { order: orderOption });
      res.json(items.map(i => camelizeKeys(i)));
    } catch (err) {
      console.error(`${entityName} list error:`, err);
      res.status(500).json({ error: `Failed to load ${entityName}` });
    }
  });

  router.post(`/${entityName}`, requireAuth, async (req, res) => {
    try {
      const newItem = {
        id: `${entityName.slice(0, -1)}_${Date.now()}`,
        ...mapFields(req.body),
        created_at: new Date().toISOString()
      };
      const result = await create(tableName, newItem);
      logActivity(`${entityName}_create`, `${entityName.slice(0, -1)} créé: ${result.name || result.title || result.id}`, req.admin.username);
      res.json({ success: true, item: camelizeKeys(result) });
    } catch (err) {
      console.error(`${entityName} create error:`, err);
      res.status(500).json({ error: `Failed to create ${entityName.slice(0, -1)}` });
    }
  });

  router.patch(`/${entityName}/:id`, requireAuth, async (req, res) => {
    try {
      const item = await update(tableName, req.params.id, {
        ...mapFields(req.body),
        updated_at: new Date().toISOString()
      });
      logActivity(`${entityName}_update`, `${entityName.slice(0, -1)} modifié: ${item.name || item.title || req.params.id}`, req.admin.username);
      res.json({ success: true, item: camelizeKeys(item) });
    } catch (err) {
      console.error(`${entityName} update error:`, err);
      if (err.code === 'PGRST116') return res.status(404).json({ error: 'Not found' });
      res.status(500).json({ error: `Failed to update ${entityName.slice(0, -1)}` });
    }
  });

  router.delete(`/${entityName}/:id`, requireAuth, async (req, res) => {
    try {
      const item = await get(tableName, req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      await remove(tableName, req.params.id);
      logActivity(`${entityName}_delete`, `${entityName.slice(0, -1)} supprimé: ${item.name || item.title || req.params.id}`, req.admin.username);
      res.json({ success: true });
    } catch (err) {
      console.error(`${entityName} delete error:`, err);
      res.status(500).json({ error: `Failed to delete ${entityName.slice(0, -1)}` });
    }
  });
}

crudRoutes('team', 'team_members');
crudRoutes('services', 'services');
crudRoutes('projects', 'projects');
crudRoutes('blog', 'blog_posts', [['date', 'desc']]);

// ─── PRICING MANAGEMENT ───
router.get('/pricing', requireAuth, async (req, res) => {
  try {
    const cfg = await getSiteConfig();
    res.json(cfg.pricing || {});
  } catch (err) {
    console.error('Pricing get error:', err);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

router.put('/pricing', requireAuth, async (req, res) => {
  try {
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

    const cfg = await getSiteConfig();
    await upsertSiteConfig({ ...cfg, pricing: incoming });
    logActivity('pricing_update', 'Grille tarifaire mise à jour', req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Pricing update error:', err);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// ─── CONTACT INFO ───
router.get('/contact-info', requireAuth, async (req, res) => {
  try {
    const cfg = await getSiteConfig();
    res.json({
      contact: cfg.contact || {},
      social: cfg.social || {},
      mission: cfg.mission || '',
      vision: cfg.vision || '',
      team: cfg.team_stats || {},
      founded: cfg.founded || 2015,
      experience_years: cfg.experience_years || 10
    });
  } catch (err) {
    console.error('Contact info get error:', err);
    res.status(500).json({ error: 'Failed to load contact info' });
  }
});

router.put('/contact-info', requireAuth, async (req, res) => {
  try {
    const cfg = await getSiteConfig();
    const updates = {};
    if (req.body.contact) updates.contact = req.body.contact;
    if (req.body.social) updates.social = req.body.social;
    if (req.body.mission) updates.mission = req.body.mission;
    if (req.body.vision) updates.vision = req.body.vision;
    if (req.body.team_stats) updates.team_stats = req.body.team_stats;
    if (req.body.experience_years) updates.experience_years = req.body.experience_years;
    if (req.body.founded) updates.founded = req.body.founded;
    if (req.body.team) updates.team_stats = req.body.team;
    await upsertSiteConfig({ ...cfg, ...updates });
    logActivity('contact_info_update', 'Informations de contact mises à jour', req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Contact info update error:', err);
    res.status(500).json({ error: 'Failed to update contact info' });
  }
});

// ─── SITE SETTINGS ───
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({
      googleAnalyticsId: settings.googleAnalyticsId || process.env.GOOGLE_ANALYTICS_ID || 'G-XXXXXXXXXX',
      whatsappNumber: settings.whatsappNumber || '261328231280',
      siteUrl: settings.siteUrl || process.env.SITE_URL || 'https://nordinvest.mg',
      seoDescription: settings.seoDescription || "Nord Invest Madagascar — Immobilier & Construction à Antsiranana. Expertise en bâtiment, forage, réhabilitation et vente immobilière.",
      seoKeywords: settings.seoKeywords || ["immobilier", "construction", "madagascar", "antsiranana", "diego-suarez", "forage", "réhabilitation"]
    });
  } catch (err) {
    console.error('Settings get error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await setSetting(key, value);
    }
    logActivity('settings_update', 'Paramètres du site mis à jour', req.admin.username);
    res.json({ success: true });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
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
