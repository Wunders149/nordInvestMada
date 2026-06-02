import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── PRICING CALCULATIONS ─── 
// Calculate pricing based on service type and specifications
app.post('/api/calculate-pricing', (req, res) => {
  try {
    const { serviceType, squareMeters, finishingLevel, projectType, location } = req.body;

    if (!serviceType || !squareMeters || !finishingLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pricingRates = {
      construction: {
        economic: 450000,      // Ariary/m²
        standard: 750000,
        premium: 1200000
      },
      rehabilitation: {
        economic: 350000,
        standard: 550000,
        premium: 850000
      },
      forage: {
        economic: 800000,      // Per borehole
        standard: 1200000,
        premium: 1800000
      }
    };

    let basePrice = pricingRates[serviceType]?.[finishingLevel];
    if (!basePrice) {
      return res.status(400).json({ error: 'Invalid service type or finishing level' });
    }

    // Apply location multiplier
    const locationMultiplier = {
      'diego-suarez': 1.0,
      'nosy-be': 1.15,
      'sambava': 1.05,
      'antalaha': 1.08,
      'other': 1.2
    };
    const multiplier = locationMultiplier[location] || 1.0;

    // Calculate total
    let totalPrice;
    if (serviceType === 'forage') {
      totalPrice = basePrice * multiplier; // Fixed per borehole
    } else {
      totalPrice = basePrice * squareMeters * multiplier;
    }

    // Add contingency (10% for complexity)
    const contingency = totalPrice * 0.1;
    const estimatedTotal = totalPrice + contingency;

    // Tax (20% VAT)
    const tax = estimatedTotal * 0.2;
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
// Handle contact form submissions
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, projectType, budget, message, serviceType } = req.body;

    // Validation
    if (!name || !email || !projectType || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send email to admin
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

    // Send confirmation email to customer
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

    // Send both emails
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
// Generate and send detailed quote
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

// ─── HEALTH CHECK ─── 
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
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

// ─── ERROR HANDLING ─── 
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Nord Invest Madagascar server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
