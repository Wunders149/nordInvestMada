import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, loginLimiter, createSession, destroySession, loginUser, logActivity, getTokenFromRequest } from './auth.js';
import { supabase, list, get, create, update, remove, getSiteConfig, upsertSiteConfig, getSetting, setSetting, getAllSettings } from './supabase.js';
import { uploadPdf, deleteImage, getPdfThumbnailUrl } from './cloudinary.js';
import { broadcast } from './events.js';
import { validate, loginSchema } from './validation.js';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

const FIELD_MAP = {
  imageSlot: 'image_slot',
  categoryId: 'image_slot'
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
  logActivity('login', 'Connexion réussie', user.username);
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/api/admin'
  });
  res.json({ success: true, token });
});

// ─── LOGOUT ───
router.post('/logout', requireAuth, async (req, res) => {
  logActivity('logout', 'Déconnexion', req.admin.username);
  const token = getTokenFromRequest(req);
  if (token) await destroySession(token);
  res.clearCookie('admin_token', { path: '/api/admin' });
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

// ─── EMAIL NOTIFICATION FOR BLOG PUBLISH ───
function createBlogTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function notifySubscribersOnPublish(post) {
  try {
    const { data: subs } = await supabase.from('subscribers').select('email');
    if (!subs || subs.length === 0) return;
    const emails = subs.map(s => s.email);

    const siteUrl = process.env.SITE_URL || 'https://nordinvest.mg';
    const postUrl = post.slug ? `${siteUrl}/blog/${encodeURIComponent(post.slug)}` : siteUrl;
    const excerpt = post.excerpt || '';
    const title = post.title || 'Nouvel article';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#8B3A2A;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">Nord Invest Madagascar</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e0d6d2;border-top:0;border-radius:0 0 8px 8px">
          <h2 style="color:#2d1810;margin-top:0">${escapeHtml(title)}</h2>
          <p style="color:#555;line-height:1.6;font-size:15px">${escapeHtml(excerpt)}</p>
          <a href="${postUrl}" style="display:inline-block;background:#8B3A2A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;margin:16px 0">Lire l'article</a>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:12px">Vous recevez cet email car vous êtes abonné à la newsletter de Nord Invest Madagascar.</p>
          <p style="color:#999;font-size:12px">${siteUrl}</p>
        </div>
      </div>
    `;

    const transporter = createBlogTransporter();
    await transporter.sendMail({
      from: `"Nord Invest Madagascar" <${process.env.SMTP_USER}>`,
      bcc: emails.join(','),
      subject: `Nouvel article : ${title}`,
      html
    });

    console.log(`Blog notification sent to ${emails.length} subscribers for: ${title}`);
  } catch (err) {
    console.error('Failed to send blog notification emails:', err.message);
  }
}

// ─── GENERIC CRUD HELPER ───
function crudRoutes(entityName, tableName, orderOption = [['order', 'asc']], callbacks = {}) {
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
      if (callbacks.onCreate) callbacks.onCreate(result, req);
      broadcast(entityName, { action: 'create', id: result.id });
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
      if (callbacks.onUpdate) callbacks.onUpdate(item, req);
      broadcast(entityName, { action: 'update', id: req.params.id });
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
      broadcast(entityName, { action: 'delete', id: req.params.id });
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
crudRoutes('blog', 'blog_posts', [['date', 'desc']], {
  onCreate: async (item) => {
    if (item.published) {
      notifySubscribersOnPublish(item);
    }
  },
  onUpdate: async (item) => {
    if (item.published) {
      notifySubscribersOnPublish(item);
    }
  }
});

// ─── BLOG CATEGORIES MANAGEMENT ───
router.get('/blog-categories', requireAuth, async (req, res) => {
  try {
    let categories = await getSetting('blog_categories');
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      categories = [
        { id: 'blog-construction', label: 'Construction', icon: '🏗️', color: 'var(--rust)', svg: 'construction.svg', image: '' },
        { id: 'blog-forage', label: 'Forage', icon: '💧', color: 'var(--blue, #2563eb)', svg: 'forage.svg', image: '' },
        { id: 'blog-immobilier', label: 'Immobilier', icon: '🏡', color: 'var(--green, #16a34a)', svg: 'immobilier.svg', image: '' }
      ];
      await setSetting('blog_categories', categories);
    }
    res.json(categories);
  } catch (err) {
    console.error('Blog categories get error:', err);
    res.status(500).json({ error: 'Failed to load blog categories' });
  }
});

router.put('/blog-categories', requireAuth, async (req, res) => {
  try {
    const categories = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories must be an array' });
    }
    for (const cat of categories) {
      if (!cat.id || !cat.label) {
        return res.status(400).json({ error: 'Each category must have an id and label' });
      }
    }
    await setSetting('blog_categories', categories);
    logActivity('blog_categories_update', 'Catégories du blog mises à jour', req.admin.username);
    broadcast('blog-categories');
    res.json({ success: true });
  } catch (err) {
    console.error('Blog categories save error:', err);
    res.status(500).json({ error: 'Failed to save blog categories' });
  }
});

// ─── TEAM POSITIONS MANAGEMENT ───
const DEFAULT_TEAM_POSITIONS = [
  { id: 'Directeur Général', label: 'Directeur Général' },
  { id: 'Ingénieur', label: 'Ingénieur' },
  { id: 'Chef de chantier', label: 'Chef de chantier' },
  { id: 'Technicien', label: 'Technicien' },
  { id: 'Comptable', label: 'Comptable' }
];

router.get('/team-positions', requireAuth, async (req, res) => {
  try {
    let positions = await getSetting('team_positions');
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      positions = DEFAULT_TEAM_POSITIONS;
      await setSetting('team_positions', positions);
    }
    res.json(positions);
  } catch (err) {
    console.error('Team positions get error:', err);
    res.status(500).json({ error: 'Failed to load team positions' });
  }
});

router.put('/team-positions', requireAuth, async (req, res) => {
  try {
    const positions = req.body;
    if (!Array.isArray(positions)) {
      return res.status(400).json({ error: 'Positions must be an array' });
    }
    for (const pos of positions) {
      if (!pos.id || !pos.label) {
        return res.status(400).json({ error: 'Each position must have an id and label' });
      }
    }
    await setSetting('team_positions', positions);
    logActivity('team_positions_update', 'Postes de l\'équipe mis à jour', req.admin.username);
    broadcast('team-positions');
    res.json({ success: true });
  } catch (err) {
    console.error('Team positions save error:', err);
    res.status(500).json({ error: 'Failed to save team positions' });
  }
});

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
    broadcast('pricing');
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
    broadcast('config');
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
      googleAnalyticsId: settings.googleAnalyticsId || process.env.GOOGLE_ANALYTICS_ID || 'G-MQ14N6E1ZG',
      whatsappNumber: settings.whatsappNumber || '261328231280',
      siteUrl: settings.siteUrl || process.env.SITE_URL || 'https://nordinvest.mg',
      seoDescription: settings.seoDescription || 'Nord Invest Madagascar — Immobilier & Construction à Antsiranana. Expertise en bâtiment, forage, études et conception et vente immobilière.',
      seoKeywords: settings.seoKeywords || ['immobilier', 'construction', 'madagascar', 'antsiranana', 'diego-suarez', 'forage', 'études', 'conception']
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
    broadcast('config');
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
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: 'Test — Nord Invest Madagascar',
      html: `<h2>Test d'envoi d'email</h2><p>Cet email confirme que votre configuration SMTP Gmail fonctionne correctement.</p><p><small>${new Date().toISOString()}</small></p>`
    });
    logActivity('email_test', `Email test envoyé à ${to}`, req.admin.username);
    res.json({ success: true, message: 'Email test envoyé avec succès' });
  } catch (err) {
    logActivity('email_test_failed', `Échec envoi test à ${to}: ${err.message}`, req.admin.username);
    res.status(500).json({ error: `Échec: ${err.message}` });
  }
});

// ─── DOSSIERS MANAGEMENT (PDF documents on Cloudinary) ───

router.get('/dossiers', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dossiers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const dossiers = (data || []).map(d => ({
      id: d.id,
      name: d.name,
      size: d.size || 0,
      cloudinary_public_id: d.cloudinary_public_id,
      cloudinary_url: d.cloudinary_url,
      thumbnail_url: d.cloudinary_public_id ? getPdfThumbnailUrl(d.cloudinary_public_id) : null,
      created_at: d.created_at
    }));
    res.json(dossiers);
  } catch (err) {
    console.error('Dossiers list error:', err);
    res.status(500).json({ error: 'Failed to list dossiers' });
  }
});

router.post('/dossiers', requireAuth, (req, res) => {
  const pdfUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Seuls les fichiers PDF sont acceptés'));
      }
    }
  });
  pdfUpload.single('pdf')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier sélectionné' });

    const ext = '.pdf';
    const baseName = path.basename(req.file.originalname, ext).trim() || `dossier_${Date.now()}`;
    const publicId = `${baseName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    const fileName = `${baseName}${ext}`;

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadPdf(req.file.buffer, {
        folder: 'dossiers',
        publicId
      });
    } catch (uploadErr) {
      console.error('Cloudinary PDF upload failed:', uploadErr);
      return res.status(500).json({ error: 'Échec de l\'upload vers Cloudinary' });
    }

    const id = `dossier_${Date.now()}`;
    try {
      await supabase.from('dossiers').insert({
        id,
        name: fileName,
        cloudinary_public_id: cloudinaryResult.public_id,
        cloudinary_url: cloudinaryResult.secure_url,
        size: req.file.size
      });
    } catch (dbErr) {
      console.error('Dossier DB insert failed:', dbErr);
      return res.status(500).json({ error: 'Échec de l\'enregistrement en base' });
    }

    logActivity('dossier_upload', `Dossier uploadé: ${fileName}`, req.admin.username);
    broadcast('dossiers');
    res.json({
      success: true,
      id,
      name: fileName,
      size: req.file.size,
      cloudinary_url: cloudinaryResult.secure_url,
      thumbnail_url: getPdfThumbnailUrl(cloudinaryResult.public_id)
    });
  });
});

router.patch('/dossiers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name: newName } = req.body;
    if (!newName || !newName.trim()) return res.status(400).json({ error: 'Nouveau nom requis' });
    let safeName = newName.trim();
    if (!safeName.toLowerCase().endsWith('.pdf')) safeName += '.pdf';

    const { data: existing } = await supabase.from('dossiers').select('id').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Dossier introuvable' });

    await supabase.from('dossiers').update({
      name: safeName,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    logActivity('dossier_rename', `Dossier renommé en: ${safeName}`, req.admin.username);
    broadcast('dossiers');
    res.json({ success: true, name: safeName });
  } catch (err) {
    console.error('Dossier rename error:', err);
    res.status(500).json({ error: 'Failed to rename dossier' });
  }
});

router.delete('/dossiers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: dossier, error: findError } = await supabase
      .from('dossiers')
      .select('*')
      .eq('id', id)
      .single();
    if (findError || !dossier) return res.status(404).json({ error: 'Dossier introuvable' });

    if (dossier.cloudinary_public_id) {
      try {
        await deleteImage(dossier.cloudinary_public_id);
      } catch (cloudErr) {
        console.error('Cloudinary delete error:', cloudErr);
      }
    }

    await supabase.from('dossiers').delete().eq('id', id);

    logActivity('dossier_delete', `Dossier supprimé: ${dossier.name}`, req.admin.username);
    broadcast('dossiers');
    res.json({ success: true });
  } catch (err) {
    console.error('Dossier delete error:', err);
    res.status(500).json({ error: 'Failed to delete dossier' });
  }
});

// ─── SECTIONS CONTENT MANAGEMENT ───
const DEFAULT_SECTIONS_CONTENT = {
  hero: { tag: 'Immobilier & Construction — Madagascar', title: 'Bâtir<br>l\'<em>excellence</em><br>au Nord.', subtitle: 'Depuis 2021, Nord Invest Madagascar conçoit et réalise vos projets de construction, études et conception, forage d\'eau et transactions immobilières avec rigueur et expertise.', badge: 'Fondée à Diego Suarez', badgeYear: '2015', stat1Label: "Années d'exp.", stat2Label: 'Techniciens', stat3Label: 'Sites — Antsiranana & Nosy Be', stat4Label: 'Ingénieurs', btnPricing: 'Voir les tarifs', btnContact: 'Demander un devis' },
  about: { tag: 'À Propos', title: 'Une expertise<br>technique au service<br>de vos projets.', lead: 'Fondée en 2015 à Antsiranana, Nord Invest Madagascar est spécialisée dans la construction, le forage d\'eau et l\'immobilier. Nous mettons en œuvre notre expertise technique pour garantir des infrastructures modernes, durables et économiques.', feat1Title: 'Conformité & Qualité', feat1Desc: 'Nous collaborons avec des architectes inscrits à l\'Ordre des Architectes pour assurer la conformité réglementaire et la qualité architecturale.', feat2Title: 'Sécurité (Safety First)', feat2Desc: 'La sécurité est notre priorité absolue. Nous appliquons rigoureusement les normes pour garantir un environnement de travail sûr.', feat3Title: 'Service Technique de Pointe', feat3Desc: 'Utilisation de logiciels professionnels (AutoCAD, ArchiCAD, Revit, Robot Structural) pour des études précises et conformes.' },
  standards: { tag: 'Normes & Sécurité', title: 'L\'ingénierie au cœur<br>de chaque ouvrage.', lead: 'Nous appliquons les standards internationaux et locaux les plus exigeants pour garantir la pérennité de vos investissements.', item1Title: 'Safety First', item1Desc: 'Priorité absolue à la sécurité des hommes et des équipements. Zones de travail balisées, équipements de protection individuels (EPI) obligatoires et contrôles réguliers des procédures.', item2Title: 'Calculs Structurels (VEx)', item2Desc: 'Nos études intègrent les normes de <strong>Vent Extrême (VEx 1 à 4)</strong> de Madagascar. Chaque structure est calculée pour résister aux conditions cycloniques spécifiques du Nord.', item2Badge: 'Conformité Madagascar', item3Title: 'Conception architectural(BIM)', item3Desc: 'Utilisation des logiciels leaders du marché : <strong>AutoCAD, Revit et ArchiCAD</strong> pour la conception, et <strong>Robot Structural Analysis</strong> pour la validation des calculs de charge.', item4Title: 'Régularité Administrative', item4Desc: 'Accompagnement pour l\'obtention des permis de construire. Collaboration systématique avec des architectes agréés inscrits à l\'Ordre National des Architectes.' },
  values: { title1: 'Qualité & Conformité', desc1: 'Respect strict des normes malgaches et internationales. Collaboration avec des architectes agréés pour des ouvrages durables et conformes.', title2: 'Sécurité Avant Tout', desc2: 'Safety First est notre règle d\'or. Équipements de protection, zones balisées et contrôles réguliers pour un chantier sans accident.', title3: 'Impact Local', desc3: 'Employeurs et formation de techniciens locaux. Utilisation de matériaux locaux pour soutenir l\'économie de la région et du pays.' },
  team: { tag: 'Notre Équipe', title: 'Des experts<br>à votre service.', lead: 'Une équipe de 34 techniciens et ingénieurs passionnés, engagés à concrétiser vos projets à travers tout Madagascar et à l\'international.' },
  services: { tag: 'Nos Services', title: 'Ce que nous<br>réalisons pour vous.', lead: 'Une offre complète, de la conception à la livraison, pour particuliers, ONG, entreprises et institutions.' },
  pricing: { tag: 'Grille Tarifaire', title: 'Des tarifs clairs,<br>au mètre carré.', lead: 'Nos prix sont exprimés en Ariary malgache (Ar) par m² avec conversion en EUR et USD. Ils varient selon la gamme de finition, la complexité du projet et sa localisation. Devis personnalisé sur demande.', tab1: 'Construction Neuve', tab2: 'Études et Conception', tab3: 'Forage d\'Eau', note: '<strong>Note importante :</strong> Les prix indiqués sont des tarifs de référence hors taxes. Le coût réel dépend des conditions d\'accès au site, du type de sol, des matériaux locaux disponibles et des spécificités de votre projet. <strong>Un devis personnalisé gratuit et sans engagement est réalisé après visite du terrain.</strong> Contactez-nous au <strong>032 82 312 80</strong> ou par email.' },
  calculator: { tag: 'Simulateur', title: 'Estimez votre<br>budget en un clic.', lead: 'Sélectionnez vos options pour obtenir une estimation budgétaire instantanée basée sur nos tarifs actuels.' },
  projects: { tag: 'Réalisations', title: 'Nos chantiers<br>parlent d\'eux-mêmes.', lead: 'Un aperçu de nos projets récents à Antsiranana, Nosy Be et dans tout le nord de Madagascar.' },
  dossiers: { tag: 'Vente de Terrains', title: 'Dossiers de terrains<br>à vendre', lead: 'Consultez nos dossiers détaillés de terrains disponibles à la vente dans le nord de Madagascar. Cliquez sur un dossier pour le consulter.' },
  blog: { tag: 'Actualités', title: 'Conseils &<br>actualités du bâtiment.', lead: 'Découvrez nos conseils techniques, pratiques et actualités sur la construction, le forage et l\'immobilier à Madagascar.' },
  contact: { tag: 'Contact', title: 'Parlons de<br>votre projet.', lead: 'Un devis gratuit et sans engagement. Nous vous répondons sous 24h ouvrées.', phone: '032 82 312 80 / 037 07 396 07', email: 'nordinvestmada@gmail.com', address: 'Tanambao 1, en face de Madahoufi, Rue Comores<br>Antsiranana (Diego Suarez)', office: 'Nosy Be', mapTitle: 'Nos Bureaux', mapProjectsTitle: 'Nos Projets sur la Carte' },
  numbers: { exp: 'Années d\'expérience', tech: 'Techniciens & ingénieurs', engineers: 'Ingénieurs génie civil', sites: 'Sites d\'opération' },
  visionMission: { visionTitle: 'Notre Vision', visionText: '"Devenir un acteur de référence dans le secteur du bâtiment et de l\'immobilier à Madagascar et en Afrique."', missionTitle: 'Notre Mission', missionText: '"Réaliser des études technique, des travaux de construction et des services immobiliers avec professionnalisme, qualité et respect des normes."' },
  newsletter: { title: 'Restez informé', desc: 'Recevez nos actualités, conseils techniques et offres spéciales par email. Pas de spam, désabonnement à tout moment.', btn: 'S\'abonner' }
};

function mergeSectionsWithDefaults(dbSections) {
  const merged = {};
  for (const [key, defaults] of Object.entries(DEFAULT_SECTIONS_CONTENT)) {
    const dbEntry = dbSections?.[key] || {};
    const filtered = {};
    for (const [fk, fv] of Object.entries(dbEntry)) {
      if (fv !== '' && fv != null) {
        filtered[fk] = fv;
      }
    }
    merged[key] = { ...defaults, ...filtered };
  }
  return merged;
}

router.get('/sections', requireAuth, async (req, res) => {
  try {
    let dbSections = await getSetting('sections_content');
    if (!dbSections || typeof dbSections !== 'object') {
      dbSections = {};
    }
    const merged = mergeSectionsWithDefaults(dbSections);
    res.json(merged);
  } catch (err) {
    console.error('Sections get error:', err);
    res.status(500).json({ error: 'Failed to load sections' });
  }
});

router.put('/sections', requireAuth, async (req, res) => {
  try {
    const sections = req.body;
    if (typeof sections !== 'object' || sections === null) {
      return res.status(400).json({ error: 'Invalid sections data' });
    }
    await setSetting('sections_content', sections);
    logActivity('sections_update', 'Contenu des sections mis à jour', req.admin.username);
    broadcast('config');
    res.json({ success: true });
  } catch (err) {
    console.error('Sections update error:', err);
    res.status(500).json({ error: 'Failed to update sections' });
  }
});

export { router as adminRouter };
