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
import { validate, contactSchema, newsletterSchema, quoteSchema, pricingSchema } from './validation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const uploadsDir = process.env.UPLOADS_DIR || path.join(projectRoot, 'uploads');
const app = express();
const PORT = process.env.PORT || 3000;

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
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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
      currency: 'Ariary (Ar)',
      disclaimer: 'This is an estimate. Final pricing depends on site conditions, soil type, and material availability.'
    });
  } catch (error) {
    console.error('Pricing calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

app.post('/api/contact', contactLimiter, validate(contactSchema), async (req, res) => {
  try {
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

    const { error: dbError } = await supabase.from('contacts').insert(contactEntry);
    if (dbError) throw dbError;

    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
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
    };

    const customerMailOptions = {
      from: process.env.EMAIL_USER,
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
    };

    try {
      await transporter.sendMail(adminMailOptions);
      await transporter.sendMail(customerMailOptions);
    } catch (mailErr) {
      console.warn('Email sending failed (contact saved to DB):', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Your request has been submitted successfully. You will receive a confirmation email shortly.'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'Failed to submit form. Please try again or contact us directly.'
    });
  }
});

app.post('/api/newsletter', newsletterLimiter, validate(newsletterSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const { data: existing } = await supabase.from('subscribers').select('email').eq('email', email).maybeSingle();
    if (existing) {
      return res.json({ success: true, message: 'Déjà inscrit' });
    }

    const { error: dbError } = await supabase.from('subscribers').insert({ email, date: new Date().toISOString() });
    if (dbError) throw dbError;

    try {
      const adminMailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: 'Nouvel abonné newsletter',
        html: `<p>Nouvel abonné : <strong>${escapeHtml(email)}</strong></p>`
      };
      await transporter.sendMail(adminMailOptions);
    } catch (mailErr) {
      console.warn('Newsletter email notification failed:', mailErr.message);
    }

    res.json({ success: true, message: 'Inscription réussie' });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/request-quote', quoteLimiter, validate(quoteSchema), async (req, res) => {
  try {
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

    const { error: dbError } = await supabase.from('quotes').insert(quoteEntry);
    if (dbError) throw dbError;

    const quoteMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      cc: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
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
    };

    try {
      await transporter.sendMail(quoteMailOptions);
    } catch (mailErr) {
      console.warn('Email sending failed (quote saved to DB):', mailErr.message);
    }

    res.json({
      success: true,
      quoteNumber,
      message: 'Your quote request has been submitted. A representative will contact you within 24 hours.'
    });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({ error: 'Failed to submit quote request' });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const siteCfg = await loadSiteConfig();
    res.json({
      ...staticConfig,
      pricing: siteCfg.pricing || staticConfig.pricing || {},
      locations: siteCfg.locations || staticConfig.locations || [],
      contingency_rate: siteCfg.contingency_rate ?? staticConfig.contingency_rate ?? 0.1,
      tax_rate: siteCfg.tax_rate ?? staticConfig.tax_rate ?? 0.2,
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
    res.json({
      pricing: siteCfg.pricing || staticConfig.pricing || {},
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

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
});
