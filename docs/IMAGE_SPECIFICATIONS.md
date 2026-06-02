# 📸 Image Management & Placement Guide

Complete specifications for adding real images to Nord Invest Madagascar website.

---

## Directory Structure

```
public/images/
├── hero/              # Hero/banner images (1920x1080px)
├── projects/          # Portfolio images (1200x675px, 16:9)
├── team/              # Team photos (300x300px & larger)
├── services/          # Service icons (SVG preferred)
├── gallery/           # Before/After, process photos
├── logo.svg           # Company logo
├── logo.png           # Logo fallback
├── favicon.ico        # Browser tab icon (32x32px)
└── og-image.png       # Social media preview (1200x630px)
```

---

## Required Images

### Hero Section
- **main-hero.jpg** (1920x1080px) - Desktop background
- **main-hero-tablet.jpg** (1280x720px) - Tablet version
- **main-hero-mobile.jpg** (768x1024px) - Mobile version
- **main-hero.webp** (1920x1080px) - Modern format

### Projects (5 images)
- **project-1-ramena.jpg** (1200x675px) - Résidence Palas Ramena
- **project-2-mahatsinjo.jpg** (1200x675px) - Bâtiments R+1
- **project-3-sambava.jpg** (1200x675px) - Centre Islamique
- **project-4-djabala.jpg** (1200x675px) - Immeuble Djabala
- **project-5-nosyhara.jpg** (1200x675px) - Dôme Géodésique

### Team Photos
- **about-main.jpg** (800x1000px) - Main company/office photo
- **about-secondary.jpg** (600x600px) - Team/work photo
- **team-group.jpg** (1200x800px) - Full team photo

### Service Icons (6 SVG files)
- icon-study.svg, icon-construction.svg, icon-renovation.svg
- icon-water.svg, icon-real-estate.svg, icon-quality.svg

### Branding
- **logo.svg** (200x100px) - Company logo
- **favicon.ico** (32x32px) - Browser tab icon
- **og-image.png** (1200x630px) - Social media preview

---

## Image Optimization

### Before Upload
- Compress with TinyPNG.com (max 2MB)
- Resize to exact dimensions
- Use JPG for photos, SVG for icons
- Create WebP versions for modern browsers

### File Naming
```
✓ Good:    main-hero.jpg, project-1-ramena.jpg, icon-construction.svg
✗ Bad:     IMG_2024.jpg, photo1.png, HERO.JPG
```

### Format Guidelines
- **JPG**: Photos, complex images
- **PNG**: Logos with transparency
- **SVG**: Icons, illustrations (scalable, tiny file)
- **WebP**: Alternative JPG (35% smaller, modern browsers)

---

## Recommended Tools

- **Compression**: https://tinypng.com, https://squoosh.app
- **Conversion**: https://cloudconvert.com
- **Batch Resize**: Bulk Image Resizer, ImageMagick
- **CDN Storage**: Cloudinary, AWS S3, Firebase

---

## Installation Steps

1. Create image directories:
```bash
mkdir -p public/images/{hero,projects,team,services,gallery}
```

2. Add your images to appropriate folders

3. Update HTML to reference new images (replace emoji placeholders)

4. Test page load and optimize if needed

---

**For full project structure, see `PROJECT_STRUCTURE.md`**
