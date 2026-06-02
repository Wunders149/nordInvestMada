# 🚀 Quick Start Guide - Nord Invest Madagascar

## What's Been Built

✅ **Full-stack website** with professional backend and SEO optimization

### Backend Features
- Contact form handling with email notifications
- Dynamic pricing calculator API
- Quote request system
- Error handling and validation

### Frontend Features
- Enhanced contact form connected to backend
- Real-time loading states and user feedback
- Comprehensive SEO meta tags
- Google Analytics event tracking
- Structured data (JSON-LD schemas)

### SEO Features
- Meta tags and Open Graph
- `sitemap.xml` for search engines
- `robots.txt` with crawl rules
- JSON-LD structured data
- Google Analytics integration

---

## ⚡ Quick Setup (5 minutes)

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Setup Email (Gmail)

**A. Enable 2-Factor Authentication**
- Go to https://myaccount.google.com/security
- Enable 2-Step Verification

**B. Create App Password**
- Go to https://myaccount.google.com/apppasswords
- Select "Mail" and "Windows Computer"
- Copy the 16-character password

**C. Create .env file**
```bash
cp .env.example .env
```

**D. Edit .env and add:**
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # Paste your 16-char app password
ADMIN_EMAIL=admin@nordinvest.mg
```

### 3️⃣ Setup Google Analytics

- Create account at https://analytics.google.com
- Get your Measurement ID (format: `G-XXXXXXXXXX`)
- Open `index.html` and replace `G-XXXXXXXXXX` with your ID (appears 2x)

### 4️⃣ Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

✅ Server running at `http://localhost:3000`

---

## 📝 Test the Form

1. Open http://localhost:3000 in browser
2. Scroll to Contact section
3. Fill and submit the form
4. Check your email for:
   - ✉️ Confirmation email to customer
   - ✉️ Admin notification to your email

---

## 📊 Check Analytics

1. Go to https://analytics.google.com
2. Wait 24-48 hours for data to appear
3. You'll see:
   - Page views
   - Form submissions
   - CTA clicks
   - Pricing tab views

---

## 🧮 Test Pricing Calculator

You can use the pricing API:

```javascript
// In browser console or JavaScript
const result = await fetch('http://localhost:3000/api/calculate-pricing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceType: 'construction',
    squareMeters: 200,
    finishingLevel: 'standard',
    location: 'diego-suarez'
  })
}).then(r => r.json());

console.log(result);
```

---

## 📁 Project Files

| File | Purpose |
|------|---------|
| `index.html` | Main website (updated with SEO & analytics) |
| `server.js` | Express backend with API endpoints |
| `package.json` | Node.js dependencies |
| `.env` | Your configuration (create from .env.example) |
| `config.json` | App settings and pricing data |
| `sitemap.xml` | SEO sitemap for Google |
| `robots.txt` | Crawl directives for search engines |
| `README.md` | Full documentation |

---

## 🔧 Environment Variables Explained

```env
NODE_ENV=development          # Set to 'production' when live
PORT=3000                     # Server port
EMAIL_USER=your-email@gmail.com   # Your Gmail
EMAIL_PASS=xxxx xxxx xxxx xxxx    # Gmail app password (NOT regular password!)
ADMIN_EMAIL=admin@nordinvest.mg   # Where to receive alerts
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX  # Your GA measurement ID
SITE_URL=https://www.nordinvest.mg  # Your domain
```

---

## ❌ Troubleshooting

### **Emails not sending?**
- ❌ Using regular Gmail password → ✅ Use App Password instead
- ❌ 2FA not enabled → ✅ Enable 2-factor authentication
- ❌ Wrong email in .env → ✅ Double-check EMAIL_USER and EMAIL_PASS

### **CORS errors?**
- ❌ API_BASE is wrong in index.html → ✅ Should be `http://localhost:3000`

### **Form not submitting?**
- ❌ Server not running → ✅ Run `npm run dev`
- ❌ Check browser console for errors

### **Analytics not working?**
- ❌ Wrong GA ID → ✅ Replace G-XXXXXXXXXX with your real ID
- ❌ Check browser console: `window.gtag` should exist

---

## 🚀 Deployment Checklist

- [ ] Update `SITE_URL` in .env to your domain
- [ ] Replace all GA IDs with production ID
- [ ] Update email addresses (ADMIN_EMAIL)
- [ ] Test all forms and APIs
- [ ] Configure domain SSL certificate
- [ ] Add sitemap to Google Search Console
- [ ] Verify robots.txt

---

## 📞 API Endpoints (For Developers)

### Contact Form
```
POST /api/contact
```

### Pricing Calculator
```
POST /api/calculate-pricing
```

### Quote Request
```
POST /api/request-quote
```

### Server Status
```
GET /api/health
```

See README.md for detailed examples.

---

## 🎯 Next Steps

1. ✅ Setup email & analytics (done above)
2. ⏳ Deploy to Heroku/Railway/VPS
3. ⏳ Setup custom domain
4. ⏳ Add SSL certificate
5. ⏳ Monitor analytics dashboard

---

**Ready to launch?** 🎉

Your website is now a full-stack production-ready application with professional backend, email integration, and SEO optimization!

Questions? Check `README.md` for complete documentation.
