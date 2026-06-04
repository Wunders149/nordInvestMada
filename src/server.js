import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { adminRouter } from './admin.js';
import { imageRouter } from './images.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ─── STATIC FILE SERVING ─── 
// Serve public folder (HTML, CSS, images, etc.)
app.use(express.static(path.join(projectRoot, 'public')));

// Serve uploads folder
app.use('/uploads', express.static(path.join(projectRoot, 'uploads')));

// Serve admin panel static files
app.use('/admin', express.static(path.join(projectRoot, 'public', 'admin')));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Load configuration
const configPath = path.join(projectRoot, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Failed to load config.json:', error);
}

// ─── PRICING CALCULATIONS ─── 
app.post('/api/calculate-pricing', (req, res) => {
  try {
    const { serviceType, squareMeters, finishingLevel, projectType, location } = req.body;

    if (!serviceType || !squareMeters || !finishingLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pricingRates = config.pricing || {};
    const servicePricing = pricingRates[serviceType]?.[finishingLevel];

    if (!servicePricing) {
      return res.status(400).json({ error: 'Invalid service type or finishing level' });
    }

    let basePrice = servicePricing.pricePerM2 || servicePricing.pricePerML || servicePricing.price;
    const unit = servicePricing.unit || (servicePricing.pricePerML ? 'ml' : 'm²');

    const locationMultiplier = {};
    if (config.locations) {
      config.locations.forEach(loc => {
        locationMultiplier[loc.code] = loc.multiplier;
      });
    }

    const multiplier = locationMultiplier[location] || 1.0;

    let totalPrice;
    if (unit === 'mission' || unit === 'intervention') {
      totalPrice = basePrice * multiplier;
    } else {
      totalPrice = basePrice * squareMeters * multiplier;
    }

    const contingency = totalPrice * (config.contingency_rate || 0.1);
    const estimatedTotal = totalPrice + contingency;
    const tax = estimatedTotal * (config.tax_rate || 0.2);
    const grandTotal = estimatedTotal + tax;

    res.json({
      serviceType,
      squareMeters: serviceType !== 'forage' ? squareMeters : 1,
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

// ─── FORM SUBMISSION ─── 
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, projectType, budget, message, serviceType } = req.body;

    if (!name || !email || !projectType || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Persist contact to JSON
    const contactsPath = path.join(projectRoot, 'data', 'contacts.json');
    let contacts = [];
    try {
      if (fs.existsSync(contactsPath)) {
        contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      }
    } catch {}
    const contactEntry = {
      id: `contact_${Date.now()}`,
      name, email, phone: phone || '',
      projectType, budget: budget || '', message,
      serviceType: serviceType || projectType,
      date: new Date().toISOString(),
      read: false,
      resolved: false,
      notes: ''
    };
    contacts.unshift(contactEntry);
    const dir = path.dirname(contactsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));

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
      console.warn('Email sending failed (contact saved locally):', mailErr.message);
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

// ─── NEWSLETTER SUBSCRIPTION ─── 
app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    // Store newsletter subscribers (append to a JSON file)
    const subscribersPath = path.join(projectRoot, 'data', 'subscribers.json');
    let subscribers = [];
    try {
      if (fs.existsSync(subscribersPath)) {
        subscribers = JSON.parse(fs.readFileSync(subscribersPath, 'utf8'));
      }
    } catch {}
    if (subscribers.find(s => s.email === email)) {
      return res.json({ success: true, message: 'D\u00e9j\u00e0 inscrit' });
    }
    subscribers.push({ email, date: new Date().toISOString() });
    const dir = path.dirname(subscribersPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));
    // Optional: send admin notification (best-effort)
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

// ─── QUOTE REQUEST ─── 
app.post('/api/request-quote', async (req, res) => {
  try {
    const { name, email, serviceType, details, location } = req.body;

    if (!name || !email || !serviceType || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const quoteNumber = `NIM-${Date.now()}`;
    const createdDate = new Date().toLocaleDateString('fr-FR');

    // Persist quote to JSON
    const quotesPath = path.join(projectRoot, 'data', 'quotes.json');
    let quotes = [];
    try {
      if (fs.existsSync(quotesPath)) {
        quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
      }
    } catch {}
    const quoteEntry = {
      id: `quote_${Date.now()}`,
      quoteNumber, name, email,
      serviceType: serviceType || '',
      details, location: location || '',
      date: new Date().toISOString(),
      status: 'pending',
      notes: ''
    };
    quotes.unshift(quoteEntry);
    const qDir = path.dirname(quotesPath);
    if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });
    fs.writeFileSync(quotesPath, JSON.stringify(quotes, null, 2));

    const quoteMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      cc: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `Demande de Devis - ${quoteNumber}`,
      html: `
        <h2>Demande de Devis - Nord Invest Madagascar</h2>
        <p><strong>Numéro de Devis:</strong> ${quoteNumber}</p>
        <p><strong>Date:</strong> ${createdDate}</p>
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
      console.warn('Email sending failed (quote saved locally):', mailErr.message);
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

// ─── CONFIGURATION ENDPOINT ─── 
app.get('/api/config', (req, res) => {
  res.json(config);
});

// ─── ADMIN API ───
app.use('/api/admin', adminRouter);

// ─── IMAGE MANAGEMENT API ───
app.use('/api', imageRouter);

// ─── HEALTH CHECK ─── 
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── CATCH-ALL FOR SPA (returns index.html for unknown non-admin routes) ───
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

// ─── ERROR HANDLING ─── 
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HELPER FUNCTION ─── 
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

// Start server
app.listen(PORT, () => {
  console.log(`✓ Nord Invest Madagascar server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Static files served from: ./public`);
  console.log(`✓ API endpoints available at: /api/*`);
});
