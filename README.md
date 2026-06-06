# Nord Invest Madagascar — Full Stack Website

Professional real estate and construction website built with Node.js/Express backend, vanilla JavaScript frontend, trilingual (FR/EN/MG), with comprehensive SEO/Analytics integration.

## Features

### Backend (Node.js/Express)
- **Contact Form Handling** — Validates (Zod), persists to Supabase, and processes contact submissions
- **Email Notifications** — Sends confirmation emails to customers and admin alerts (graceful degradation)
- **Pricing Calculator API** — Dynamic pricing calculations based on service type and specifications
- **Quote Request System** — Dedicated endpoint with Supabase persistence for detailed quote requests
- **Newsletter Subscription** — Email signup with Supabase storage and admin notification
- **Image Listing API** — Scans and serves available project/team/hero images with metadata
- **Config Endpoint** — Merges static config.json with dynamic Supabase site_config
- **Admin Dashboard API** — Secure token-based auth persisted in Supabase, CRUD for contacts/quotes/subscribers/team/services/projects/blog, stats, CSV export
- **Image Upload & Management API** — Cloudinary-based upload, slot system, rename, replace, delete
- **Rate Limiting** — 5 req/15min on contact/quote, 3 req/15min on newsletter, 30 req/15min on pricing
- **Input Validation** — Zod schemas for all public and admin endpoints
- **Session Persistence** — Admin sessions stored in Supabase with in-memory cache (survives restarts)
- CORS, error handling, activity logging

### Frontend Features
- **Responsive Design** — Mobile-first, works on all devices (480px to 1440px+)
- **SEO Optimized** — Meta tags, structured data (JSON-LD), Open Graph, Twitter Cards
- **Google Analytics** — Event tracking for form submissions, CTA clicks, pricing tabs, theme toggle, language switch
- **Smooth Animations** — Scroll-reveal effects, animated counters, loader overlay
- **Interactive Forms** — Client-side validation and backend integration with auto-fill from pricing cards
- **Pricing Calculator** — Live budget estimator with 3 service tiers, location multiplier, tax/contingency breakdown
- **Interactive Pricing Tabs** — Construction / Rehabilitation / Forage with feature cards and CTA
- **Gallery Lightbox** — Click-to-expand project images with keyboard navigation
- **Theme Toggle** — Dark/Light mode with persistent localStorage
- **Language Switcher** — FR / EN / MG with full i18n translations
- **WhatsApp Floating Button** — Fixed position with pulse animation
- **Admin Dashboard** — Login-protected SPA with stats, search/filter, status management, bulk actions, CSV export, image gallery manager, pricing editor, settings editor, activity log, and CRUD for team/services/projects/blog
- **Loader Navigation** — Animated section transitions on nav link click
- **Animated Counters** — Number roll-up animation on scroll into view
- **Project Map** — Embedded OpenStreetMap with project location pins
- **Office Map** — Embedded OpenStreetMap with business locations
- **Back to Top** — Fixed button appears on scroll

### SEO & Analytics
- Meta tags, JSON-LD Schema (LocalBusiness + Organization)
- Google Analytics page views and event tracking
- Sitemap.xml, robots.txt
- Open Graph & Twitter Cards

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm
- Supabase project (free tier)
- Brevo account (free tier — 300 emails/day for email sending)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file:

```env
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Brevo SMTP
SMTP_USER=your-brevo-login@email.com
SMTP_PASS=your-brevo-smtp-key
ADMIN_EMAIL=admin@nordinvest.mg

# Google Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Site
SITE_URL=https://nordinvest.mg

# Admin fallback (used only if admin_users table is empty)
ADMIN_USER=admin
ADMIN_PASS=nordinvest2026
```

### Step 3: Database Setup
Run the schema in `supabase-schema.sql` against your Supabase project's SQL editor. This creates all 13 tables.

### Step 4: Migrate existing data
```bash
node src/migrate.js
```

### Step 5: Run the Server
```bash
npm run dev   # development with nodemon
npm start     # production
```

## API Endpoints

### Public

| Method | Path | Rate Limit | Description |
|--------|------|------------|-------------|
| POST | `/api/contact` | 5/15min | Contact form submission |
| POST | `/api/newsletter` | 3/15min | Newsletter signup |
| POST | `/api/request-quote` | 5/15min | Quote request |
| POST | `/api/calculate-pricing` | 30/15min | Pricing calculator |
| GET | `/api/config` | — | Site configuration |
| GET | `/api/team` | — | Team members (visible only) |
| GET | `/api/services` | — | Services (visible only) |
| GET | `/api/projects` | — | Projects (visible only) |
| GET | `/api/blog` | — | Blog posts (published only) |
| GET | `/api/pricing` | — | Pricing grid, rates, locations |
| GET | `/api/health` | — | Health check |

### Admin (all require `Authorization: Bearer <token>`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Authenticate (rate limited: 10/15min) |
| POST | `/api/admin/logout` | Destroy session |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET/PATCH/DELETE | `/api/admin/contacts/:id` | Contacts CRUD |
| GET/PATCH/DELETE | `/api/admin/quotes/:id` | Quotes CRUD |
| GET/DELETE | `/api/admin/subscribers/:email` | Newsletter subscribers |
| GET/POST/PATCH/DELETE | `/api/admin/team` | Team members CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/services` | Services CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/projects` | Projects CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/blog` | Blog posts CRUD |
| GET/PUT | `/api/admin/pricing` | Pricing grid editor |
| GET/PUT | `/api/admin/contact-info` | Contact/social/mission/vision |
| GET/PUT | `/api/admin/settings` | Site settings |
| GET | `/api/admin/activity` | Activity log |
| POST | `/api/admin/test-email` | Send test email |

### Images

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/images` | Bearer | List all images grouped by section (from Supabase + Cloudinary) |
| POST | `/api/upload` | Bearer | Upload image — saved to Cloudinary, metadata in Supabase |
| DELETE | `/api/images/:section/:filename` | Bearer | Delete image from Cloudinary + local disk |
| PUT | `/api/images/:section/:filename/rename` | Bearer | Rename image (updates slot label, Cloudinary public_id stays stable) |
| POST | `/api/images/:section/:filename/replace` | Bearer | Replace image file — uploads new to Cloudinary, removes old |
| GET | `/api/images/slots` | — | List all image slots with Cloudinary URLs |
| PUT | `/api/images/slots/:id` | Bearer | Assign image to slot |
| POST | `/api/images/slots` | Bearer | Create new slot |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default 3000) |
| `SMTP_USER` | Yes | Brevo login email (SMTP username) |
| `SMTP_PASS` | Yes | Brevo SMTP key |
| `ADMIN_EMAIL` | No | Where to receive contact alerts |
| `GOOGLE_ANALYTICS_ID` | No | GA4 measurement ID |
| `SITE_URL` | No | Canonical site URL |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `ADMIN_USER` | No | Admin username (fallback) |
| `ADMIN_PASS` | No | Admin password (fallback) |

## Project Structure

```
orinvestmada/
├── src/
│   ├── server.js           # Express entry point (routes, rate limiters, email)
│   ├── admin.js            # Admin API router (CRUD, pricing, settings, activity)
│   ├── auth.js             # Auth middleware, session management (Supabase-backed)
│   ├── images.js           # Image upload/management API (Cloudinary + slots)
│   ├── cloudinary.js       # Cloudinary config + upload/delete/list helpers
│   ├── supabase.js         # Supabase client + generic CRUD helpers
│   ├── validation.js       # Zod schemas + validate() middleware
│   ├── migrate.js          # One-time JSON → Supabase migration script
│   └── migrate-cloudinary.js  # One-time local → Cloudinary migration script
├── public/
│   ├── index.html          # Main website (SPA)
│   ├── admin/
│   │   ├── login.html      # Admin login page
│   │   ├── dashboard.html  # Admin dashboard shell
│   │   ├── css/admin.css
│   │   └── js/
│   │       ├── main.js     # Module entry point + tab switching
│   │       └── modules/
│   │           ├── api.js         # Shared state & fetch helpers
│   │           ├── helpers.js     # formatDate, escapeHtml, humanSize
│   │           ├── ui.js          # Toast, confirm, skeleton, pagination, dark mode, lightbox
│   │           ├── dashboard.js   # Stats, charts, dashboard widgets
│   │           ├── contacts.js    # Contacts tab CRUD
│   │           ├── quotes.js      # Quotes tab CRUD
│   │           ├── subscribers.js # Newsletter tab
│   │           ├── images.js      # Gallery upload, slots, editor
│   │           ├── content.js     # Team/Services/Projects/Blog CRUD
│   │           ├── pricing.js     # Pricing grid editor
│   │           ├── settings.js    # Settings, contact info, email test
│   │           └── activity.js    # Activity log viewer
│   ├── css/
│   ├── js/
│   ├── locales/ (fr.json, en.json, mg.json)
│   ├── images/ (hero/, about/, team/, projects/, blog/, standards/)
│   ├── sitemap.xml
│   └── robots.txt
├── data/                   # JSON file fallbacks
├── uploads/                # Runtime uploads
├── docs/
├── supabase-schema.sql     # Full database schema (13 tables)
├── config.json             # Static app configuration
├── package.json
└── README.md
```

## Database Schema

13 tables in Supabase:

| Table | Purpose |
|-------|---------|
| `admin_users` | bcrypt-hashed login credentials |
| `sessions` | Persistent admin login sessions |
| `contacts` | Contact form submissions |
| `quotes` | Quote requests |
| `subscribers` | Newsletter emails |
| `team_members` | Team CRUD |
| `services` | Service offerings |
| `projects` | Portfolio projects |
| `blog_posts` | Blog articles |
| `activity_logs` | Admin action audit trail |
| `image_slots` | Labeled image placeholders |
| `settings` | Key-value store (GA, WhatsApp, SEO) |
| `site_config` | Singleton — pricing grid, contact info, rates |

## Deployment

## Cloudinary Migration

Images are stored on **Cloudinary CDN** for optimized delivery, automatic format conversion (`f_auto`), quality optimization (`q_auto`), and CDN edge caching.

### Migration Status

The codebase is fully Cloudinary-ready. All uploads go directly to Cloudinary via server-side upload (Multer memory → Cloudinary API). Two data sources coexist:

- **Cloudinary** — primary storage for uploaded images
- **Local `public/images/`** — fallback SVGs served via `express.static`

The `image_slots` table has been extended with `cloudinary_public_id` and `cloudinary_url` columns in Supabase.

### Running the Migration

To migrate existing local images to Cloudinary:

```bash
# 1. Ensure Cloudinary env vars are set in .env
# 2. Run the migration script
node src/migrate-cloudinary.js
```

The script will:
1. Upload all files from `public/images/*/` to Cloudinary under `nord-invest/{section}/`
2. Upload logo and standards SVGs to Cloudinary
3. Create or update `image_slots` entries with Cloudinary public IDs and URLs
4. Print a summary and next steps (update OG meta tags, JSON-LD)

### Cloudinary Folder Structure

```
nord-invest/
├── hero/        # Hero section images
├── about/       # About section images
├── team/        # Team member photos
├── projects/    # Project portfolio images
├── blog/        # Blog post images
├── gallery/     # Gallery images
├── services/    # Service section images
├── standards/   # Standards/security icons
├── logos/       # Company logo
└── gallery/     # Additional gallery images
```

### Image Slot URL Resolution

The `GET /api/images/slots` endpoint returns each slot with a `currentUrl` field. The resolution order is:

1. `cloudinary_url` — Cloudinary CDN URL (if migrated)
2. `uploaded_file` — Local path to user-uploaded image
3. `original_file` — Local path to fallback SVG
4. `placeholder.svg` — Generic placeholder image

### Render
1. Push to GitHub
2. Create Web Service on [dashboard.render.com](https://dashboard.render.com)
3. Set build command: `npm install`
4. Set start command: `node src/server.js`
5. Add environment variables (see table above)
6. Deploy

### Self-hosted
```bash
npm install -g pm2
pm2 start src/server.js --name "nord-invest"
pm2 startup
pm2 save
```

## License

© 2026 Nord Invest Madagascar — Immobilier & Construction. All rights reserved.
