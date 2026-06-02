# Nord Invest Madagascar — Full Stack Website

Professional real estate and construction website built with Node.js/Express backend, vanilla JavaScript frontend, and comprehensive SEO/Analytics integration.

## 📋 Features

### Backend (Node.js/Express)
- ✅ **Contact Form Handling** - Validates and processes contact submissions
- ✅ **Email Notifications** - Sends confirmation emails to customers and admin alerts
- ✅ **Pricing Calculator API** - Dynamic pricing calculations based on service type and specifications
- ✅ **Quote Request System** - Dedicated endpoint for detailed quote requests
- ✅ **CORS Support** - Cross-origin requests enabled
- ✅ **Error Handling** - Comprehensive error logging and user-friendly responses

### Frontend Features
- ✅ **Responsive Design** - Mobile-first, works on all devices
- ✅ **SEO Optimized** - Meta tags, structured data (JSON-LD), Open Graph
- ✅ **Google Analytics** - Event tracking for user interactions
- ✅ **Smooth Animations** - Scroll-reveal effects for better UX
- ✅ **Interactive Forms** - Client-side validation and backend integration

### SEO & Analytics
- ✅ **Meta Tags** - Comprehensive metadata for search engines and social media
- ✅ **JSON-LD Schema** - Structured data for LocalBusiness and Organization
- ✅ **Google Analytics** - Page views, event tracking (form submissions, CTA clicks)
- ✅ **Sitemap.xml** - Proper XML sitemap for search engine crawling
- ✅ **robots.txt** - Crawl directives and rate limiting
- ✅ **Open Graph** - Social media preview optimization

## 🚀 Installation & Setup

### Prerequisites
- Node.js 14+ installed
- npm or yarn
- Gmail account (for email sending)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
NODE_ENV=development
PORT=3000

# Gmail Configuration (use App Password, not regular password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
ADMIN_EMAIL=admin@nordinvest.mg

# Google Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Site Configuration
SITE_URL=https://www.nordinvest.mg
```

### Step 3: Gmail Setup (for Email Sending)
1. Enable 2-Factor Authentication on your Gmail account
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Copy the 16-character password to `EMAIL_PASS` in `.env`

### Step 4: Run the Server
```bash
# Development mode (with nodemon auto-reload)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:3000`

## 📚 API Endpoints

### Contact Form Submission
**POST** `/api/contact`

Request body:
```json
{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "phone": "032 82 312 80",
  "serviceType": "construction",
  "projectType": "Villa",
  "budget": "50 millions Ar",
  "message": "Je souhaite construire une villa..."
}
```

Response:
```json
{
  "success": true,
  "message": "Your request has been submitted successfully..."
}
```

### Pricing Calculator
**POST** `/api/calculate-pricing`

Request body:
```json
{
  "serviceType": "construction",
  "squareMeters": 200,
  "finishingLevel": "standard",
  "location": "diego-suarez"
}
```

Response:
```json
{
  "serviceType": "construction",
  "squareMeters": 200,
  "basePrice": 750000,
  "subtotal": 150000000,
  "contingency": 15000000,
  "estimatedTotal": 165000000,
  "tax": 33000000,
  "grandTotal": 198000000,
  "currency": "Ariary (Ar)"
}
```

### Quote Request
**POST** `/api/request-quote`

Request body:
```json
{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "serviceType": "construction",
  "location": "diego-suarez",
  "details": "Je souhaite construire une villa R+1..."
}
```

### Health Check
**GET** `/api/health`

Response:
```json
{
  "status": "Server is running",
  "timestamp": "2026-06-02T10:30:00.000Z"
}
```

## 📊 Google Analytics Setup

1. Create a Google Analytics property at https://analytics.google.com
2. Get your Measurement ID (format: `G-XXXXXXXXXX`)
3. Update in `index.html` and `.env`:
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   ```

### Tracked Events
- `form_submission` - When users submit the contact form
- `pricing_tab_view` - When users switch pricing tabs
- `cta_click` - When users click call-to-action buttons
- Page views (automatic)

## 🔒 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `3000` |
| `EMAIL_USER` | Gmail address | `your-email@gmail.com` |
| `EMAIL_PASS` | Gmail app password | `xxxx xxxx xxxx xxxx` |
| `ADMIN_EMAIL` | Admin email for alerts | `admin@nordinvest.mg` |
| `GOOGLE_ANALYTICS_ID` | GA measurement ID | `G-XXXXXXXXXX` |
| `SITE_URL` | Production URL | `https://www.nordinvest.mg` |

## 📁 Project Structure

```
orinvestmada/
├── index.html              # Main website (with SEO & Analytics)
├── server.js              # Express.js backend
├── package.json           # Dependencies
├── .env.example           # Environment template
├── .env                   # Local configuration (ignored by git)
├── sitemap.xml            # SEO sitemap
├── robots.txt             # Crawl directives
└── README.md              # This file
```

## 🌐 Deployment

### Option 1: Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create and deploy
heroku create nord-invest-madagascar
git push heroku main
heroku config:set EMAIL_USER=xxx EMAIL_PASS=xxx
```

### Option 2: Railway.app
1. Connect GitHub repo to Railway
2. Add environment variables
3. Deploy

### Option 3: Self-hosted (VPS/Dedicated)
```bash
# Install Node.js on server
# Clone repository
# Install dependencies
npm install

# Run with PM2 for persistence
npm install -g pm2
pm2 start server.js --name "nord-invest"
pm2 startup
pm2 save
```

## 🔧 Troubleshooting

### Emails not sending
- Verify Gmail App Password (not regular password)
- Check Gmail 2FA is enabled
- Ensure `EMAIL_USER` and `EMAIL_PASS` are correct in `.env`

### CORS errors in frontend
- Ensure `API_BASE` in `index.html` matches server URL
- Development: `http://localhost:3000`
- Production: `https://www.nordinvest.mg`

### Form submissions failing
- Check browser console for error messages
- Verify backend server is running (`npm run dev`)
- Ensure email configuration is correct

### Analytics not tracking
- Replace `G-XXXXXXXXXX` with your actual Google Analytics ID
- Allow 24-48 hours for data to appear in GA dashboard
- Check browser console for gtag errors

## 📞 Contact Information

- **Phone**: +261 32 82 312 80 / +261 37 07 396 07
- **Email**: nordinvestmada@gmail.com
- **Address**: Tanambao 1, Rue Comores, Antsiranana (Diego Suarez)
- **Branch**: Nosy Be

## 📜 License

© 2025 Nord Invest Madagascar — Immobilier & Construction. All rights reserved.

## 🎯 Next Steps

1. ✅ Backend form handling
2. ✅ Email integration
3. ✅ Pricing API
4. ✅ SEO optimization
5. ⏳ SMS notifications (optional)
6. ⏳ Database integration (MongoDB)
7. ⏳ Admin dashboard
8. ⏳ Project gallery with image uploads
9. ⏳ Multi-language support (FR/EN/MG)
10. ⏳ Payment gateway integration

---

**Last Updated**: June 2, 2026  
**Built with**: Node.js, Express.js, Vanilla JS, HTML5, CSS3  
**Frontend Framework**: None (vanilla JavaScript)
