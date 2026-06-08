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

// ─── DOSSIERS (PDF listings) ───
app.get('/api/dossiers', (req, res) => {
  const dossierDir = path.join(projectRoot, 'public', 'Dossier');
  try {
    if (!fs.existsSync(dossierDir)) {
      return res.json([]);
    }
    const thumbDir = path.join(projectRoot, 'uploads', 'thumbnails');
    const files = fs.readdirSync(dossierDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(dossierDir, f));
        const thumbFile = path.join(thumbDir, f.replace(/\.pdf$/i, '.jpg'));
        return {
          name: f.replace(/\.pdf$/i, ''),
          file: f,
          size: stat.size,
          modified: stat.mtime,
          hasThumbnail: fs.existsSync(thumbFile)
        };
      })
      .sort((a, b) => b.modified - a.modified);
    res.json(files);
  } catch (err) {
    console.error('Dossier list error:', err);
    res.status(500).json({ error: 'Failed to list dossiers' });
  }
});

// ─── Thumbnail cache dir ───
const thumbDir = path.join(projectRoot, 'uploads', 'thumbnails');
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

async function generateThumbnail(pdfPath, outputPath) {
  try {
    if (fs.existsSync(outputPath)) return;
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');
    const buf = fs.readFileSync(pdfPath);
    const data = new Uint8Array(buf);
    class NodeFactory {
      create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
      reset(c, w, h) { c.canvas.width = w; c.canvas.height = h; }
      destroy() {}
    }
    const doc = await getDocument({ data, canvasFactory: new NodeFactory(), disableFontFace: true }).promise;
    const page = await doc.getPage(1);
    const scale = 0.4;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    doc.destroy();
    fs.writeFileSync(outputPath, canvas.toBuffer('image/jpeg', { quality: 0.75 }));
  } catch (err) {
    console.error('Thumbnail gen error for', pdfPath, err.message);
  }
}

function pregenerateThumbnails() {
  const dossierDir = path.join(projectRoot, 'public', 'Dossier');
  if (!fs.existsSync(dossierDir)) return;
  const files = fs.readdirSync(dossierDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  files.forEach(f => {
    const pdfPath = path.join(dossierDir, f);
    const thumbFile = path.join(thumbDir, f.replace(/\.pdf$/i, '.jpg'));
    generateThumbnail(pdfPath, thumbFile);
  });
}

app.get('/api/dossiers/:file/thumbnail', async (req, res) => {
  const dossierDir = path.join(projectRoot, 'public', 'Dossier');
  const requestedFile = path.basename(req.params.file);
  const filePath = path.join(dossierDir, requestedFile);
  try {
    if (!requestedFile.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const thumbFile = path.join(thumbDir, requestedFile.replace(/\.pdf$/i, '.jpg'));
    if (fs.existsSync(thumbFile)) {
      return res.sendFile(thumbFile);
    }
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');
    const buf = fs.readFileSync(filePath);
    const data = new Uint8Array(buf);
    class NodeFactory {
      create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
      reset(c, w, h) { c.canvas.width = w; c.canvas.height = h; }
      destroy() {}
    }
    const doc = await getDocument({ data, canvasFactory: new NodeFactory(), disableFontFace: true }).promise;
    const page = await doc.getPage(1);
    const scale = 0.4;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    doc.destroy();
    const jpeg = canvas.toBuffer('image/jpeg', { quality: 0.75 });
    fs.writeFileSync(thumbFile, jpeg);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(jpeg);
  } catch (err) {
    console.error('Thumbnail error:', err);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

app.get('/api/dossiers/:file', (req, res) => {
  const dossierDir = path.join(projectRoot, 'public', 'Dossier');
  const requestedFile = path.basename(req.params.file);
  const filePath = path.join(dossierDir, requestedFile);
  try {
    if (!requestedFile.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const allowedPath = path.resolve(dossierDir);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(allowedPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', isDownload
      ? `attachment; filename="${encodeURIComponent(requestedFile)}"`
      : `inline; filename="${encodeURIComponent(requestedFile)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('Dossier serve error:', err);
    res.status(500).json({ error: 'Failed to serve dossier' });
  }
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
  if (process.env.NODE_ENV !== 'production') {
    setImmediate(() => pregenerateThumbnails());
  }
});
