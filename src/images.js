import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth, logActivity, writeJSON, readJSON } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const imagesDir = path.join(projectRoot, 'public', 'images');
const slotsPath = path.join(dataDir, 'image-slots.json');

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const section = req.body.section || 'gallery';
    const dir = path.join(imagesDir, section);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const ts = Date.now();
    cb(null, `${base}-${ts}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG, WebP, GIF ou SVG.'));
    }
  }
});

function readSlots() {
  try {
    if (!fs.existsSync(slotsPath)) return { slots: [] };
    return JSON.parse(fs.readFileSync(slotsPath, 'utf8'));
  } catch { return { slots: [] }; }
}

function getImageMetadata(filePath, relativePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: relativePath.replace(/\\/g, '/'),
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      type: path.extname(filePath).toLowerCase().slice(1)
    };
  } catch { return null; }
}

// ─── UPLOAD IMAGE ───
router.post('/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Fichier trop volumineux (max 10MB)' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const section = req.body.section || 'gallery';
    const slotId = req.body.slotId || null;

    const relativePath = path.join('images', section, req.file.filename).replace(/\\/g, '/');
    const url = `/${relativePath}`;
    const metadata = getImageMetadata(req.file.path, relativePath);

    const data = readSlots();
    const newSlotLabel = req.body.newSlotLabel;

    if (newSlotLabel) {
      const slug = newSlotLabel
        .toLowerCase()
        .replace(/[^a-z0-9-\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const id = `${section}-${slug}-${Date.now()}`;
      data.slots.push({
        id,
        section,
        originalFile: req.file.filename,
        label: newSlotLabel,
        uploadedFile: req.file.filename,
        updatedAt: new Date().toISOString()
      });
    } else if (slotId) {
      const slot = data.slots.find(s => s.id === slotId);
      if (slot) {
        slot.uploadedFile = req.file.filename;
        slot.updatedAt = new Date().toISOString();
      }
    }

    const slotsDir = path.dirname(slotsPath);
    if (!fs.existsSync(slotsDir)) fs.mkdirSync(slotsDir, { recursive: true });
    fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    logActivity('image_upload', `Image uploadée: ${req.file.filename} (${section})`, req.admin?.username || 'admin');

    res.json({
      success: true,
      url,
      file: metadata
    });
  });
});

// ─── LIST IMAGES ───
router.get('/images', requireAuth, (req, res) => {
  try {
    const result = {};
    const dirs = fs.readdirSync(imagesDir);
    dirs.forEach(dir => {
      const dirPath = path.join(imagesDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath)
          .filter(f => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f))
          .map(f => {
            const fp = path.join(dirPath, f);
            const rp = path.join('images', dir, f);
            return getImageMetadata(fp, rp);
          })
          .filter(Boolean)
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        if (files.length > 0) result[dir] = files;
      }
    });
    res.json(result);
  } catch (error) {
    console.error('Image listing error:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// ─── DELETE IMAGE ───
router.delete('/images/:section/:filename', requireAuth, (req, res) => {
  try {
    const { section, filename } = req.params;
    if (section.includes('..') || filename.includes('..') || section.includes('/') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const filePath = path.join(imagesDir, section, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé' });

    fs.unlinkSync(filePath);

    const data = readSlots();
    let changed = false;
    data.slots.forEach(s => {
      if (s.section === section && s.uploadedFile === filename) {
        s.uploadedFile = null;
        s.updatedAt = null;
        changed = true;
      }
    });
    if (changed) fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    logActivity('image_delete', `Image supprimée: ${filename} (${section})`, req.admin?.username || 'admin');

    res.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ─── RENAME IMAGE ───
router.put('/images/:section/:filename/rename', requireAuth, (req, res) => {
  try {
    const { section, filename } = req.params;
    const { newName } = req.body;
    if (!newName || !newName.trim()) return res.status(400).json({ error: 'Nouveau nom requis' });
    if (section.includes('..') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const ext = path.extname(filename);
    const baseNew = path.basename(newName.trim(), ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!baseNew) return res.status(400).json({ error: 'Nom invalide après nettoyage' });
    const newFilename = `${baseNew}${ext}`;

    const oldPath = path.join(imagesDir, section, filename);
    const newPath = path.join(imagesDir, section, newFilename);
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Fichier non trouvé' });
    if (fs.existsSync(newPath)) return res.status(409).json({ error: 'Un fichier avec ce nom existe déjà' });

    fs.renameSync(oldPath, newPath);

    const data = readSlots();
    let changed = false;
    data.slots.forEach(s => {
      if (s.section === section && s.uploadedFile === filename) {
        s.uploadedFile = newFilename;
        s.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (s.section === section && s.originalFile === filename) {
        s.originalFile = newFilename;
        changed = true;
      }
    });
    if (changed) fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    const relativePath = path.join('images', section, newFilename).replace(/\\/g, '/');
    logActivity('image_rename', `Image renommée: ${filename} → ${newFilename} (${section})`, req.admin?.username || 'admin');

    res.json({
      success: true,
      file: {
        name: newFilename,
        path: relativePath,
        url: `/${relativePath}`
      }
    });
  } catch (error) {
    console.error('Image rename error:', error);
    res.status(500).json({ error: 'Failed to rename image' });
  }
});

// ─── REPLACE IMAGE ───
router.post('/images/:section/:filename/replace', requireAuth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Fichier trop volumineux (max 10MB)' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const { section, filename } = req.params;
    if (section.includes('..') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const oldPath = path.join(imagesDir, section, filename);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    const relativePath = path.join('images', section, req.file.filename).replace(/\\/g, '/');

    const data = readSlots();
    let changed = false;
    data.slots.forEach(s => {
      if (s.section === section && s.uploadedFile === filename) {
        s.uploadedFile = req.file.filename;
        s.updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    logActivity('image_replace', `Image remplacée: ${filename} → ${req.file.filename} (${section})`, req.admin?.username || 'admin');

    res.json({
      success: true,
      url: `/${relativePath}`,
      file: {
        name: req.file.filename,
        path: relativePath,
        size: req.file.size
      }
    });
  });
});

// ─── GET SLOT ASSIGNMENTS ───
router.get('/images/slots', (req, res) => {
  try {
    const data = readSlots();
    const result = (data.slots || []).map(s => ({
      ...s,
      currentFile: s.uploadedFile || s.originalFile || 'placeholder.svg',
      currentUrl: `/images/${s.section}/${s.uploadedFile || s.originalFile || 'placeholder.svg'}`
    }));
    res.json(result);
  } catch (error) {
    console.error('Slots error:', error);
    res.status(500).json({ error: 'Failed to load slots' });
  }
});

// ─── ASSIGN IMAGE TO SLOT ───
router.put('/images/slots/:slotId', requireAuth, (req, res) => {
  try {
    const { slotId } = req.params;
    const { filename } = req.body;

    const data = readSlots();
    const slot = data.slots.find(s => s.id === slotId);
    if (!slot) return res.status(404).json({ error: 'Slot non trouvé' });

    if (filename) {
      const filePath = path.join(imagesDir, slot.section, filename);
      if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Fichier introuvable dans cette section' });
      slot.uploadedFile = filename;
    } else {
      slot.uploadedFile = null;
    }
    slot.updatedAt = new Date().toISOString();
    fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    logActivity('slot_assign', `Slot ${slotId} assigné à ${filename || 'aucun'}`, req.admin?.username || 'admin');

    res.json({
      success: true,
      slot: {
        ...slot,
        currentFile: slot.uploadedFile || slot.originalFile || 'placeholder.svg',
        currentUrl: `/images/${slot.section}/${slot.uploadedFile || slot.originalFile || 'placeholder.svg'}`
      }
    });
  } catch (error) {
    console.error('Slot assign error:', error);
    res.status(500).json({ error: 'Failed to assign slot' });
  }
});

// ─── CREATE NEW SLOT ───
router.post('/images/slots', requireAuth, (req, res) => {
  try {
    const { section, label } = req.body;
    if (!section || !label) return res.status(400).json({ error: 'Section et label requis' });

    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `${section}-${slug}-${Date.now()}`;

    const data = readSlots();
    data.slots.push({
      id,
      section,
      originalFile: null,
      label,
      uploadedFile: null,
      updatedAt: null
    });
    fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));

    logActivity('slot_create', `Slot créé: ${label} (${section})`, req.admin?.username || 'admin');

    res.status(201).json({
      success: true,
      slot: {
        id, section, label,
        originalFile: null, uploadedFile: null, updatedAt: null,
        currentFile: 'placeholder.svg',
        currentUrl: `/images/${section}/placeholder.svg`
      }
    });
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

export { router as imageRouter };
