import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(customerMailOptions);

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

// ─── QUOTE REQUEST ─── 
app.post('/api/request-quote', async (req, res) => {
  try {
    const { name, email, serviceType, details, location } = req.body;

    if (!name || !email || !serviceType || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const quoteNumber = `NIM-${Date.now()}`;
    const createdDate = new Date().toLocaleDateString('fr-FR');

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

    await transporter.sendMail(quoteMailOptions);

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

// ─── IMAGE MANAGEMENT (optional - for future image uploads) ─── 
app.get('/api/images', (req, res) => {
  try {
    const imagesPath = path.join(projectRoot, 'public', 'images');
    const images = {};

    // Scan image directories
    const dirs = fs.readdirSync(imagesPath);
    dirs.forEach(dir => {
      const dirPath = path.join(imagesPath, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        images[dir] = fs.readdirSync(dirPath).filter(f => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f));
      }
    });

    res.json(images);
  } catch (error) {
    console.error('Image listing error:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// ─── CONFIGURATION ENDPOINT ─── 
app.get('/api/config', (req, res) => {
  res.json(config);
});

// ─── HEALTH CHECK ─── 
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── CATCH-ALL FOR SPA (returns index.html for unknown routes) ─── 
app.get('*', (req, res) => {
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
