# 📁 Project Structure Guide

## Standard Full-Stack Organization

```
orinvestmada/
│
├── 📂 src/                          # Backend code
│   └── server.js                    # Express.js server (main entry point)
│
├── 📂 public/                       # Frontend static files (served by Express)
│   ├── index.html                   # Main website
│   ├── sitemap.xml                  # SEO sitemap
│   ├── robots.txt                   # Search engine directives
│   │
│   └── 📂 images/                   # All images organized by type
│       ├── 📂 hero/                 # Hero/banner images
│       │   ├── main-hero.jpg        # 1920x1080px, optimized
│       │   ├── main-hero.webp       # Modern format alternative
│       │   └── main-hero-mobile.jpg # Mobile version (600x800px)
│       │
│       ├── 📂 projects/             # Portfolio project images
│       │   ├── project-1-ramena.jpg          # 16:9 aspect ratio
│       │   ├── project-2-mahatsinjo.jpg
│       │   ├── project-3-sambava.jpg
│       │   ├── project-4-djabala.jpg
│       │   └── project-5-nosyhara.jpg
│       │
│       ├── 📂 team/                 # Team member photos
│       │   ├── ceo-photo.jpg        # Square format (300x300px)
│       │   ├── engineer-1.jpg
│       │   ├── engineer-2.jpg
│       │   └── team-group.jpg       # Full team photo
│       │
│       ├── 📂 services/             # Service icons/images
│       │   ├── icon-construction.svg
│       │   ├── icon-renovation.svg
│       │   ├── icon-water.svg
│       │   ├── icon-real-estate.svg
│       │   ├── icon-supervision.svg
│       │   └── icon-study.svg
│       │
│       ├── 📂 gallery/              # Before/After, process images
│       │   ├── before-after-1.jpg
│       │   ├── construction-process-1.jpg
│       │   └── finished-project-1.jpg
│       │
│       ├── logo.svg                 # Company logo
│       ├── logo.png                 # Logo fallback
│       ├── favicon.ico              # Favicon
│       └── og-image.png             # Social media preview (1200x630px)
│
├── 📂 uploads/                      # User-generated uploads (temp files, documents)
│   └── (empty - fills at runtime)
│
├── 📂 docs/                         # Documentation
│   ├── PROJECT_STRUCTURE.md         # This file
│   ├── IMAGE_GUIDE.md               # Image specs and locations
│   ├── API_DOCUMENTATION.md         # API endpoints reference
│   └── DEPLOYMENT_GUIDE.md          # Deployment instructions
│
├── 📂 config/                       # Configuration files (optional)
│   └── pricing.json                 # Pricing configuration
│
├── .env.example                     # Environment template
├── .env                             # Your local configuration (NEVER commit)
├── .gitignore                       # Git exclusions
├── package.json                     # Node dependencies
├── package-lock.json                # Dependency lock file
│
├── README.md                        # Main documentation
├── QUICKSTART.md                    # Quick start guide
├── config.json                      # App configuration & metadata
│
└── 🚀 Root level files              # Run from here: npm start / npm run dev
```

---

## Directory Purpose Reference

| Directory | Purpose | Content |
|-----------|---------|---------|
| `src/` | Backend logic | Express server, API routes, middleware |
| `public/` | Frontend files | Served by Express as static content |
| `public/images/` | Visual assets | Organized by type (hero, projects, team, etc.) |
| `uploads/` | User uploads | Generated files, temp documents |
| `docs/` | Documentation | Guides, API docs, deployment info |

---

## File Types by Directory

### `/src/`
- `server.js` - Main Express application

### `/public/`
- `index.html` - Single Page Application (SPA)
- `*.xml` - SEO sitemaps
- `*.txt` - Robots and configuration files

### `/public/images/`
- **Hero**: `.jpg`, `.webp`, `.png` (responsive images)
- **Projects**: `.jpg` (large, 1200+ px wide)
- **Team**: `.jpg`, `.png` (square, 300+ px)
- **Services**: `.svg` (vectors, crisp on all sizes)
- **Gallery**: `.jpg`, `.png` (various sizes)

---

## Getting Started with Images

### 1. **Hero Section**
Place your best construction/office image:
```
/public/images/hero/main-hero.jpg (1920x1080px)
```

### 2. **Project Portfolio**
Add 5 project images (16:9 aspect ratio):
```
/public/images/projects/project-N.jpg (1200x675px)
```

### 3. **Team Photos**
Add team member and group photos:
```
/public/images/team/ceo-photo.jpg (300x300px, square)
/public/images/team/team-group.jpg (any size, optimized)
```

### 4. **Service Icons**
Create or add service icons:
```
/public/images/services/icon-construction.svg
```

### 5. **Company Logo**
Add your logo in both formats:
```
/public/images/logo.svg (preferred)
/public/images/logo.png (fallback)
```

---

## Image Best Practices

### Optimization
- **Compress** images before uploading (TinyPNG, ImageOptim)
- **Use WebP** format for modern browsers (fallback to JPG)
- **Responsive sizes**: Create mobile versions (50% width)
- **Max file size**: 2MB per image

### Naming Convention
```
✓ Good:    main-hero.jpg, project-1-ramena.jpg, team-ceo.jpg
✗ Bad:     IMG_2024.jpg, DSC001.JPG, photo(1).png
```

### Image Specifications

| Section | Format | Size | Aspect Ratio | Max MB |
|---------|--------|------|--------------|--------|
| Hero | JPG/WebP | 1920x1080 | 16:9 | 2 |
| Projects | JPG | 1200x675 | 16:9 | 1.5 |
| Team | JPG/PNG | 300x300 | 1:1 | 0.5 |
| Services | SVG | 200x200 | 1:1 | 0.2 |
| Logo | SVG | 200x100 | 2:1 | 0.3 |

---

## Build and Deployment

### Development
```bash
cd orinvestmada
npm install
npm run dev
# Runs on http://localhost:3000
```

### Production
```bash
npm start
# Serve public/ folder as static files
```

---

## API Routes

All API routes are prefixed with `/api/`:

```
POST /api/contact              - Form submission
POST /api/calculate-pricing    - Pricing calculator
POST /api/request-quote        - Quote request
GET  /api/health               - Server status
GET  /api/images               - List available images
```

---

## Environment Setup

Create `.env` from `.env.example`:

```env
NODE_ENV=development
PORT=3000

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
ADMIN_EMAIL=admin@nordinvest.mg

# Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Site
SITE_URL=http://localhost:3000
```

---

## Next Steps

1. ✅ Project structure created
2. ⏳ Add real images to `/public/images/` folders
3. ⏳ Update image paths in `public/index.html`
4. ⏳ Configure `.env` file
5. ⏳ Run `npm install && npm run dev`
6. ⏳ Test form and API endpoints
7. ⏳ Deploy to production

---

**For image management details, see `IMAGE_GUIDE.md`**  
**For API documentation, see `API_DOCUMENTATION.md`**  
**For deployment, see `DEPLOYMENT_GUIDE.md`**
