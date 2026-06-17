import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { adminRouter } from './admin.js';
import { imageRouter } from './images.js';
import { supabase, getSiteConfig } from './supabase.js';
import { addClient, broadcast, heartbeat as sseHeartbeat } from './events.js';
import { getPdfThumbnailUrl, getPdfUrl } from './cloudinary.js';
import { validate, contactSchema, newsletterSchema, quoteSchema, pricingSchema } from './validation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const uploadsDir = process.env.UPLOADS_DIR || path.join(projectRoot, 'uploads');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(projectRoot, 'public')));
app.use('/uploads', express.static(uploadsDir));

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const imagesSubdirs = ['hero', 'about', 'team', 'projects', 'blog', 'gallery', 'services', 'standards'];
const imagesBase = path.join(projectRoot, 'public', 'images');
imagesSubdirs.forEach(sub => {
  const d = path.join(imagesBase, sub);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use('/admin', express.static(path.join(projectRoot, 'public', 'admin')));

// ─── Rate Limiters ───
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de demandes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de demandes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const pricingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Load static config.json and dynamic site_config
const configPath = path.join(projectRoot, 'config.json');
let staticConfig = {};
try {
  staticConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Failed to load config.json:', error);
}

async function loadSiteConfig() {
  try {
    return await getSiteConfig();
  } catch {
    return {};
  }
}

// ─── Live Exchange Rates (cached, 1h TTL) ───
let ratesCache = { rates: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000;

async function fetchLiveExchangeRates() {
  const now = Date.now();
  if (ratesCache.rates && (now - ratesCache.timestamp) < CACHE_TTL) {
    return ratesCache.rates;
  }
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/mga.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const mga = data.mga || {};
    const rates = {
      EUR: mga.eur ? Math.round(1 / mga.eur) : null,
      USD: mga.usd ? Math.round(1 / mga.usd) : null
    };
    if (rates.EUR && rates.USD) {
      ratesCache = { rates, timestamp: now };
      console.log('Live exchange rates updated');
      return rates;
    }
    throw new Error('Invalid rates from API');
  } catch (err) {
    console.warn('Live rates unavailable, using fallback:', err.message);
    return null;
  }
}

async function getExchangeRates() {
  const live = await fetchLiveExchangeRates();
  if (live) return live;
  return staticConfig.exchange_rates || {};
}

app.post('/api/calculate-pricing', pricingLimiter, validate(pricingSchema), async (req, res) => {
  try {
    const { serviceType, squareMeters, finishingLevel, projectType, location } = req.body;

    const sqMeters = parseFloat(squareMeters);
    if (!serviceType || !squareMeters || !finishingLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (isNaN(sqMeters) || sqMeters <= 0) {
      return res.status(400).json({ error: 'Invalid square meters value' });
    }

    const siteCfg = await loadSiteConfig();
    const pricingRates = siteCfg.pricing || staticConfig.pricing || {};
    const servicePricing = pricingRates[serviceType]?.[finishingLevel];

    if (!servicePricing) {
      return res.status(400).json({ error: 'Invalid service type or finishing level' });
    }

    let basePrice = servicePricing.pricePerM2 || servicePricing.pricePerML || servicePricing.price;
    const unit = servicePricing.unit || (servicePricing.pricePerML ? 'ml' : 'm²');

    const locationMultiplier = {};
    const locations = siteCfg.locations || staticConfig.locations || [];
    locations.forEach(loc => {
      locationMultiplier[loc.code] = loc.multiplier;
    });

    const multiplier = locationMultiplier[location] || 1.0;

    let totalPrice;
    if (unit === 'mission' || unit === 'intervention') {
      totalPrice = basePrice * multiplier;
    } else {
      totalPrice = basePrice * sqMeters * multiplier;
    }

    const contingencyRate = siteCfg.contingency_rate ?? staticConfig.contingency_rate ?? 0.1;
    const taxRate = siteCfg.tax_rate ?? staticConfig.tax_rate ?? 0.2;
    const contingency = totalPrice * contingencyRate;
    const estimatedTotal = totalPrice + contingency;
    const tax = estimatedTotal * taxRate;
    const grandTotal = estimatedTotal + tax;

    const rates = await getExchangeRates();
    const eurTotal = rates.EUR ? Math.round(grandTotal / rates.EUR) : null;
    const usdTotal = rates.USD ? Math.round(grandTotal / rates.USD) : null;

    res.json({
      serviceType,
      squareMeters: serviceType !== 'forage' ? sqMeters : 1,
      finishingLevel,
      location,
      basePrice: Math.round(basePrice),
      subtotal: Math.round(totalPrice),
      contingency: Math.round(contingency),
      estimatedTotal: Math.round(estimatedTotal),
      tax: Math.round(tax),
      grandTotal: Math.round(grandTotal),
      grandTotalEUR: eurTotal,
      grandTotalUSD: usdTotal,
      exchangeRates: rates,
      currency: 'Ariary (Ar)',
      disclaimer: 'This is an estimate. Final pricing depends on site conditions, soil type, and material availability.'
    });
  } catch (error) {
    console.error('Pricing calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

app.post('/api/contact', contactLimiter, validate(contactSchema), async (req, res) => {
  const { name, email, phone, projectType, budget, message, serviceType } = req.body;

  const contactEntry = {
    id: `contact_${Date.now()}`,
    name, email, phone,
    project_type: projectType,
    budget, message,
    service_type: serviceType || projectType,
    date: new Date().toISOString(),
    read: false,
    resolved: false,
    notes: ''
  };

  try {
    const { error: dbError } = await supabase.from('contacts').insert(contactEntry);
    if (dbError) console.warn('Contact DB save failed:', dbError.message);
  } catch (dbErr) {
    console.warn('Contact DB save failed:', dbErr.message);
  }

  let emailSent = false;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: `Nouvelle demande de contact - ${projectType}`,
      html: `
        <h2>Nouvelle Demande de Contact</h2>
        <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Téléphone:</strong> ${escapeHtml(phone || 'Non fourni')}</p>
        <p><strong>Type de Service:</strong> ${escapeHtml(serviceType || projectType)}</p>
        <p><strong>Type de Projet:</strong> ${escapeHtml(projectType)}</p>
        <p><strong>Budget Estimé:</strong> ${escapeHtml(budget || 'Non spécifié')}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>Date: ${new Date().toLocaleString('fr-FR')}</em></p>
      `
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Confirmation - Nord Invest Madagascar',
      html: `
        <h2>Merci de votre intérêt!</h2>
        <p>Bonjour ${escapeHtml(name)},</p>
        <p>Nous avons bien reçu votre demande de contact. Notre équipe vous répondra sous 24 heures ouvrables.</p>
        <p><strong>Récapitulatif de votre demande:</strong></p>
        <ul>
          <li>Type de projet: ${escapeHtml(projectType)}</li>
          <li>Service demandé: ${escapeHtml(serviceType || projectType)}</li>
          <li>Budget: ${escapeHtml(budget || 'Non spécifié')}</li>
        </ul>
        <p>En attendant, n'hésitez pas à nous contacter directement:</p>
        <p>📞 <strong>032 82 312 80</strong></p>
        <p>📧 contact@nordinvest.mg</p>
        <p>Cordialement,<br>L'équipe Nord Invest Madagascar</p>
      `
    });
    emailSent = true;
  } catch (mailErr) {
    console.warn('Email sending failed:', mailErr.message);
  }

  res.json({
    success: true,
    emailSent,
    message: emailSent
      ? 'Votre demande a été envoyée. Vous recevrez un email de confirmation.'
      : 'Votre demande a été reçue (l\'email de confirmation n\'a pas pu être envoyé).'
  });
});

app.post('/api/newsletter', newsletterLimiter, validate(newsletterSchema), async (req, res) => {
  const { email: subscriberEmail } = req.body;

  try {
    const { data: existing } = await supabase.from('subscribers').select('email').eq('email', subscriberEmail).maybeSingle();
    if (existing) {
      return res.json({ success: true, message: 'Déjà inscrit' });
    }

    const { error: dbError } = await supabase.from('subscribers').insert({ email: subscriberEmail, date: new Date().toISOString() });
    if (dbError) console.warn('Newsletter DB save failed:', dbError.message);
  } catch (dbErr) {
    console.warn('Newsletter DB save failed:', dbErr.message);
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: 'Nouvel abonné newsletter',
      html: `<p>Nouvel abonné : <strong>${escapeHtml(subscriberEmail)}</strong></p>`
    });
  } catch (mailErr) {
    console.warn('Newsletter email notification failed:', mailErr.message);
  }

  res.json({ success: true, message: 'Inscription réussie' });
});

app.post('/api/request-quote', quoteLimiter, validate(quoteSchema), async (req, res) => {
  const { name, email, serviceType, details, location } = req.body;

  const quoteNumber = `NIM-${Date.now()}`;
  const quoteEntry = {
    id: `quote_${Date.now()}`,
    quote_number: quoteNumber, name, email,
    service_type: serviceType,
    details, location,
    date: new Date().toISOString(),
    status: 'pending',
    notes: ''
  };

  try {
    const { error: dbError } = await supabase.from('quotes').insert(quoteEntry);
    if (dbError) console.warn('Quote DB save failed:', dbError.message);
  } catch (dbErr) {
    console.warn('Quote DB save failed:', dbErr.message);
  }

  let emailSent = false;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      cc: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: `Demande de Devis - ${quoteNumber}`,
      html: `
        <h2>Demande de Devis - Nord Invest Madagascar</h2>
        <p><strong>Numéro de Devis:</strong> ${quoteNumber}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        <p><strong>Client:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Type de Service:</strong> ${escapeHtml(serviceType)}</p>
        <p><strong>Localisation:</strong> ${escapeHtml(location || 'À déterminer')}</p>
        <h3>Détails du Projet:</h3>
        <p>${escapeHtml(details).replace(/\n/g, '<br>')}</p>
        <hr>
        <p><strong>Prochaines étapes:</strong></p>
        <ol>
          <li>Visite du terrain (gratuit)</li>
          <li>Analyse des besoins</li>
          <li>Devis personnalisé détaillé</li>
          <li>Présentation et discussion</li>
        </ol>
        <p>Notre équipe vous contactera sous 24 heures pour programmer une visite.</p>
        <p>📞 032 82 312 80 | 📧 contact@nordinvest.mg</p>
      `
    });
    emailSent = true;
  } catch (mailErr) {
    console.warn('Email sending failed:', mailErr.message);
  }

  res.json({
    success: true,
    emailSent,
    quoteNumber,
    message: emailSent
      ? 'Votre demande de devis a été envoyée. Vous recevrez un email de confirmation.'
      : 'Votre demande de devis a été reçue (l\'email n\'a pas pu être envoyé).'
  });
});

app.get('/api/config', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    const siteCfg = await loadSiteConfig();
    const rates = await getExchangeRates();
    res.json({
      ...staticConfig,
      pricing: siteCfg.pricing || staticConfig.pricing || {},
      exchange_rates: rates,
      contingency_rate: siteCfg.contingency_rate ?? staticConfig.contingency_rate ?? 0.1,
      tax_rate: siteCfg.tax_rate ?? staticConfig.tax_rate ?? 0.2,
      experience_years: siteCfg.experience_years ?? staticConfig.experience_years ?? 10,
      contact: siteCfg.contact || staticConfig.contact || {},
      social: siteCfg.social || staticConfig.social || {},
      mission: siteCfg.mission || staticConfig.mission || '',
      vision: siteCfg.vision || staticConfig.vision || '',
      team_stats: siteCfg.team_stats || staticConfig.team || {}
    });
  } catch {
    res.json(staticConfig);
  }
});

async function publicList(req, res, tableName, filterKey, orderBy) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(filterKey, true)
      .order(orderBy || 'order', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(`${tableName} public list error:`, err);
    res.status(500).json({ error: `Failed to load ${tableName}` });
  }
}

app.get('/api/team', (req, res) => {
  publicList(req, res, 'team_members', 'visible', 'order');
});

app.get('/api/services', (req, res) => {
  publicList(req, res, 'services', 'visible', 'order');
});

app.get('/api/projects', (req, res) => {
  publicList(req, res, 'projects', 'visible', 'order');
});

app.get('/api/blog', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('date', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Blog public list error:', err);
    res.status(500).json({ error: 'Failed to load blog posts' });
  }
});

app.get('/api/pricing', async (req, res) => {
  try {
    const siteCfg = await loadSiteConfig();
    const rates = await getExchangeRates();
    res.json({
      pricing: siteCfg.pricing || staticConfig.pricing || {},
      exchange_rates: rates,
      contingency_rate: siteCfg.contingency_rate ?? staticConfig.contingency_rate ?? 0.1,
      tax_rate: siteCfg.tax_rate ?? staticConfig.tax_rate ?? 0.2,
      locations: siteCfg.locations || staticConfig.locations || []
    });
  } catch {
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

app.use('/api/admin', adminRouter);
app.use('/api', imageRouter);

// ─── DOSSIERS (PDF documents hosted on Cloudinary) ───
app.get('/api/dossiers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dossiers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const dossiers = (data || []).map(d => ({
      id: d.id,
      name: d.name,
      file: d.name,
      size: d.size || 0,
      cloudinary_public_id: d.cloudinary_public_id,
      cloudinary_url: d.cloudinary_url,
      thumbnail_url: d.cloudinary_public_id ? getPdfThumbnailUrl(d.cloudinary_public_id) : null,
      created_at: d.created_at
    }));
    res.json(dossiers);
  } catch (err) {
    console.error('Dossier list error:', err);
    res.status(500).json({ error: 'Failed to list dossiers' });
  }
});

app.get('/api/dossiers/:id/view', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dossiers')
      .select('cloudinary_url, cloudinary_public_id, name')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Dossier not found' });
    const url = req.query.download === '1'
      ? data.cloudinary_url?.replace('/upload/', '/upload/fl_attachment/')
      : data.cloudinary_url;
    if (!url) return res.status(404).json({ error: 'Dossier URL not available' });
    res.redirect(url);
  } catch (err) {
    console.error('Dossier view error:', err);
    res.status(500).json({ error: 'Failed to serve dossier' });
  }
});

app.get('/api/dossiers/:id/thumbnail', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dossiers')
      .select('cloudinary_public_id')
      .eq('id', req.params.id)
      .single();
    if (error || !data || !data.cloudinary_public_id) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }
    const thumbUrl = getPdfThumbnailUrl(data.cloudinary_public_id);
    if (!thumbUrl) return res.status(404).json({ error: 'Thumbnail not available' });
    res.redirect(thumbUrl);
  } catch (err) {
    console.error('Dossier thumbnail error:', err);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});


app.get('/api/blog-categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'blog_categories')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    const categories = data?.value || [
      { id: 'blog-construction', label: 'Construction', icon: '🏗️', color: 'var(--rust)', svg: 'construction.svg', image: '' },
      { id: 'blog-forage', label: 'Forage', icon: '💧', color: 'var(--blue, #2563eb)', svg: 'forage.svg', image: '' },
      { id: 'blog-immobilier', label: 'Immobilier', icon: '🏡', color: 'var(--green, #16a34a)', svg: 'immobilier.svg', image: '' }
    ];
    res.json(categories);
  } catch (err) {
    console.error('Blog categories error:', err);
    res.status(500).json({ error: 'Failed to load blog categories' });
  }
});

app.get('/api/team-positions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'team_positions')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    const positions = data?.value || [
      { id: 'Directeur Général', label: 'Directeur Général' },
      { id: 'Ingénieur', label: 'Ingénieur' },
      { id: 'Chef de chantier', label: 'Chef de chantier' },
      { id: 'Technicien', label: 'Technicien' },
      { id: 'Comptable', label: 'Comptable' }
    ];
    res.json(positions);
  } catch (err) {
    console.error('Team positions error:', err);
    res.status(500).json({ error: 'Failed to load team positions' });
  }
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');
  addClient(res);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/admin', (req, res) => res.redirect('/admin/login.html'));
app.get('/admin/', (req, res) => res.redirect('/admin/login.html'));

app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

app.listen(PORT, () => {
  console.log(`✓ Nord Invest Madagascar server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Uploads directory: ${uploadsDir}`);
  console.log(`✓ API endpoints available at: /api/*`);

  // SSE heartbeat every 25s to keep connections alive
  setInterval(() => sseHeartbeat(), 25000);
});
