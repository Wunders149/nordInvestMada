# Nord Invest Madagascar — Full Stack Website

Professional real estate and construction website built with Node.js/Express backend, vanilla JavaScript frontend, trilingual (FR/EN/MG), with comprehensive SEO/Analytics integration.

## 📋 Features

### Backend (Node.js/Express)
- ✅ **Contact Form Handling** — Validates, persists to JSON, and processes contact submissions
- ✅ **Email Notifications** — Sends confirmation emails to customers and admin alerts (graceful degradation if unavailable)
- ✅ **Pricing Calculator API** — Dynamic pricing calculations based on service type and specifications
- ✅ **Quote Request System** — Dedicated endpoint with JSON persistence for detailed quote requests
- ✅ **Newsletter Subscription** — Email signup with JSON file storage and admin notification
- ✅ **Image Listing API** — Scans and serves available project/team/hero images
- ✅ **Config Endpoint** — Exposes site configuration (services, pricing, locations)
- ✅ **Admin Dashboard API** — Secure token-based auth, CRUD for contacts/quotes/subscribers, stats, CSV export
- ✅ **Image Upload & Management API** — Multer-based upload, slot system, delete, metadata listing
- ✅ **CORS Support** — Cross-origin requests enabled
- ✅ **Error Handling** — Comprehensive error logging and user-friendly responses

### Frontend Features
- ✅ **Responsive Design** — Mobile-first, works on all devices (480px to 1440px+)
- ✅ **SEO Optimized** — Meta tags, structured data (JSON-LD), Open Graph, Twitter Cards
- ✅ **Google Analytics** — Event tracking for user interactions (form, CTA, pricing tabs, theme toggle, language switch)
- ✅ **Smooth Animations** — Scroll-reveal effects, animated counters, loader overlay
- ✅ **Interactive Forms** — Client-side validation and backend integration with auto-fill from pricing cards
- ✅ **Pricing Calculator** — Live budget estimator with 3 service tiers, location multiplier, tax/contingency breakdown
- ✅ **Interactive Pricing Tabs** — Construction / Réhabilitation / Forage with feature cards and CTA
- ✅ **Gallery Lightbox** — Click-to-expand project images with keyboard navigation
- ✅ **Theme Toggle** — Dark/Light mode with persistent localStorage
- ✅ **Language Switcher** — FR / EN / MG with full i18n translations
- ✅ **WhatsApp Floating Button** — Fixed position with pulse animation
- ✅ **Newsletter Signup** — Inline form with success/error feedback
- ✅ **Admin Dashboard** — Login-protected panel with stats, search, status management, CSV export, and image gallery manager
- ✅ **Loader Navigation** — Animated section transitions on nav link click
- ✅ **Animated Counters** — Number roll-up animation on scroll into view
- ✅ **Project Map** — Embedded OpenStreetMap with project location pins
- ✅ **Office Map** — Embedded OpenStreetMap with business locations
- ✅ **Back to Top** — Fixed button appears on scroll

### SEO & Analytics
- ✅ **Meta Tags** — Comprehensive metadata for search engines and social media
- ✅ **JSON-LD Schema** — Structured data for LocalBusiness and Organization
- ✅ **Google Analytics** — Page views, event tracking (form submissions, CTA clicks, pricing tabs, theme changes, language switches)
- ✅ **Sitemap.xml** — Proper XML sitemap for search engine crawling
- ✅ **robots.txt** — Crawl directives and rate limiting
- ✅ **Open Graph & Twitter Cards** — Social media preview optimization

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

### Newsletter Subscription
**POST** `/api/newsletter`

Request body:
```json
{
  "email": "client@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "Inscription réussie"
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

### Configuration
**GET** `/api/config`

Returns the full site configuration (services, pricing, locations, contact info).

### Image Listing (Enhanced)
**GET** `/api/images`

Returns a directory listing of all available images with metadata (size, type, lastModified), grouped by section.

### Image Upload
**POST** `/api/upload`

Multipart form data with fields:
- `image` — File (JPG, PNG, WebP, GIF, SVG; max 10MB)
- `section` — Target directory (`hero`, `about`, `team`, `projects`, `blog`, `gallery`)
- `slotId` — (Optional) Auto-assign to an image slot

Response:
```json
{
  "success": true,
  "url": "/images/hero/my-photo-1717488826423.jpg",
  "file": {
    "name": "my-photo-1717488826423.jpg",
    "path": "images/hero/my-photo-1717488826423.jpg",
    "size": 123456,
    "type": "jpg",
    "lastModified": "2026-06-04T12:00:00.000Z"
  }
}
```

### Image Delete
**DELETE** `/api/images/:section/:filename`

Deletes an image file and resets any slot using it back to the original SVG.

### Image Slots — Get Assignments
**GET** `/api/images/slots`

Returns all 16 image slots with their current assignments:
```json
[
  {
    "id": "hero",
    "section": "hero",
    "label": "Hero - Architecture",
    "originalFile": "architecture.svg",
    "uploadedFile": "my-photo.jpg",
    "currentFile": "my-photo.jpg",
    "currentUrl": "/images/hero/my-photo.jpg"
  }
]
```

### Image Slots — Assign
**PUT** `/api/images/slots/:slotId`

```json
{ "filename": "my-photo.jpg" }
```

Set `filename` to `null` to reset to the original SVG placeholder.

### Admin Login
**POST** `/api/admin/login`

Request body:
```json
{
  "username": "admin",
  "password": "nordinvest2026"
}
```

Response:
```json
{
  "success": true,
  "token": "aa1d47d414aa38e64b6df68aac1f126862d57689830ce077a075698c2b6536bc"
}
```

> **Note**: Default credentials can be changed via `ADMIN_USER` and `ADMIN_PASS` environment variables.

### Admin: Dashboard Stats
**GET** `/api/admin/stats`

Requires `Authorization: Bearer <token>` header.

Response:
```json
{
  "totalContacts": 12,
  "unreadContacts": 3,
  "totalQuotes": 5,
  "pendingQuotes": 2,
  "totalSubscribers": 45,
  "contactsThisMonth": 4,
  "lastUpdate": "2026-06-04T06:39:57.546Z"
}
```

### Admin: List Contacts
**GET** `/api/admin/contacts`

Returns all contact form submissions (newest first).

### Admin: Update Contact Status
**PATCH** `/api/admin/contacts/:id`

```json
{ "read": true, "resolved": true }
```

### Admin: Delete Contact
**DELETE** `/api/admin/contacts/:id`

### Admin: List Quotes
**GET** `/api/admin/quotes`

Returns all quote requests (newest first).

### Admin: Update Quote Status
**PATCH** `/api/admin/quotes/:id`

```json
{ "status": "in-progress" }
```

Status values: `pending`, `in-progress`, `completed`, `cancelled`

### Admin: Delete Quote
**DELETE** `/api/admin/quotes/:id`

### Admin: List Subscribers
**GET** `/api/admin/subscribers`

Returns all newsletter subscribers (newest first).

### Admin: Delete Subscriber
**DELETE** `/api/admin/subscribers/:email`

### Admin: Logout
**POST** `/api/admin/logout`

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
| `ADMIN_USER` | Admin dashboard username | `admin` |
| `ADMIN_PASS` | Admin dashboard password | `nordinvest2026` |

## 📁 Project Structure

```
orinvestmada/
├── src/
│   ├── server.js              # Express.js backend (entry point)
│   ├── admin.js               # Admin API router (auth, CRUD, stats)
│   └── images.js              # Image upload/management API (multer, slots, CRUD)
├── public/
│   ├── index.html             # Main website (SPA with SEO & Analytics)
│   ├── admin/                 # Admin dashboard
│   │   ├── login.html         # Admin login page
│   │   ├── dashboard.html     # Admin dashboard (stats, tables, actions)
│   │   ├── css/admin.css      # Admin dashboard styles
│   │   └── js/admin.js        # Admin dashboard logic
│   ├── css/style.css          # Styles (theme, responsive, animations)
│   ├── js/main.js             # Frontend logic (i18n, calculator, gallery, forms)
│   ├── locales/               # i18n translations
│   │   ├── fr.json            # French
│   │   ├── en.json            # English
│   │   └── mg.json            # Malagasy
│   ├── images/                # SVG placeholders & logo (organised by section)
│   │   ├── hero/              # Hero section image
│   │   ├── about/             # About section images
│   │   ├── team/              # Team member avatars
│   │   ├── projects/          # Project thumbnails
│   │   ├── blog/              # Blog article images
│   │   ├── standards/         # Standards icons
│   │   └── logo.jpeg          # Company logo
│   ├── sitemap.xml            # SEO sitemap
│   └── robots.txt             # Crawl directives
├── data/
│   ├── contacts.json          # Contact form submissions (created on first submission)
│   ├── quotes.json            # Quote requests (created on first submission)
│   ├── subscribers.json       # Newsletter subscriber storage
│   └── image-slots.json       # Image slot definitions & assignments
├── uploads/                   # User-generated uploads (runtime)
├── docs/                      # Documentation
├── config.json                # App configuration & metadata
├── package.json               # Dependencies
├── .env.example               # Environment template
├── .env                       # Local configuration (ignored by git)
└── README.md                  # This file
```

## 🌐 Deployment

### Option 1: Railway.app / Render / Fly.io
1. Connect GitHub repo to the platform
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables from `.env.example`
5. Deploy

### Option 2: Self-hosted (VPS/Dedicated)
```bash
# Install Node.js on server
# Clone repository
# Install dependencies
cd orinvestmada && npm install

# Run with PM2 for persistence
npm install -g pm2
pm2 start src/server.js --name "nord-invest"
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

© 2026 Nord Invest Madagascar — Immobilier & Construction. All rights reserved.

## 🎯 Next Steps

1. ✅ Backend form handling
2. ✅ Email integration
3. ✅ Pricing API + frontend calculator
4. ✅ SEO optimization (JSON-LD, OG, sitemap, robots)
5. ✅ Multi-language support (FR/EN/MG)
6. ✅ Gallery lightbox with keyboard nav
7. ✅ Newsletter subscription
8. ✅ Theme toggle (dark/light)
9. ✅ **Real project photos** — SVG placeholders can now be replaced via the admin image gallery uploader (16 managed slots)
10. ✅ **JSON persistence** — Contact, quote, and subscriber data stored locally (MongoDB optional)
11. ✅ **Admin dashboard** — Login-protected panel with stats, CRUD, search, CSV export, and image gallery manager
12. ✅ **Image upload** — Admin panel with multer upload, slot assignment, preview, and delete
13. ⏳ **Database integration (MongoDB)** — Replace JSON file storage with MongoDB/Mongoose models
14. ⏳ **Blog CMS** — Manage blog articles from a dashboard
15. ⏳ **SMS notifications** — Optional SMS alerts for new leads
16. ⏳ **Payment gateway** — Online deposit/payment integration

---

**Last Updated**: June 4, 2026  
**Built with**: Node.js, Express.js, Vanilla JS, HTML5, CSS3  
**Frontend Framework**: None (vanilla JavaScript)
