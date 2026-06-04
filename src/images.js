import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const imagesDir = path.join(projectRoot, 'public', 'images');
const slotsPath = path.join(dataDir, 'image-slots.json');

const router = Router();

// ─── Multer setup ───
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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

// ─── Helpers ───
function readSlots() {
  try {
    if (!fs.existsSync(slotsPath)) return { slots: [] };
    return JSON.parse(fs.readFileSync(slotsPath, 'utf8'));
  } catch { return { slots: [] }; }
}

function writeSlots(data) {
  const dir = path.dirname(slotsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(slotsPath, JSON.stringify(data, null, 2));
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
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
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

    // If a slot ID was provided, auto-assign
    if (slotId) {
      const data = readSlots();
      const slot = data.slots.find(s => s.id === slotId);
      if (slot) {
        slot.uploadedFile = req.file.filename;
        slot.updatedAt = new Date().toISOString();
        writeSlots(data);
      }
    }

    res.json({
      success: true,
      url,
      file: metadata
    });
  });
});

// ─── LIST IMAGES WITH METADATA ───
router.get('/images', (req, res) => {
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
router.delete('/images/:section/:filename', (req, res) => {
  try {
    const { section, filename } = req.params;
    // Prevent path traversal
    if (section.includes('..') || filename.includes('..') || section.includes('/') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const filePath = path.join(imagesDir, section, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé' });

    fs.unlinkSync(filePath);

    // Unassign from any slot using this file
    const data = readSlots();
    let changed = false;
    data.slots.forEach(s => {
      if (s.section === section && s.uploadedFile === filename) {
        s.uploadedFile = null;
        s.updatedAt = null;
        changed = true;
      }
    });
    if (changed) writeSlots(data);

    res.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ─── GET SLOT ASSIGNMENTS ───
router.get('/images/slots', (req, res) => {
  try {
    const data = readSlots();
    // Build response with full URLs
    const result = data.slots.map(s => ({
      ...s,
      currentFile: s.uploadedFile || s.originalFile,
      currentUrl: `/images/${s.section}/${s.uploadedFile || s.originalFile}`
    }));
    res.json(result);
  } catch (error) {
    console.error('Slots error:', error);
    res.status(500).json({ error: 'Failed to load slots' });
  }
});

// ─── ASSIGN IMAGE TO SLOT ───
router.put('/images/slots/:slotId', (req, res) => {
  try {
    const { slotId } = req.params;
    const { filename } = req.body;

    const data = readSlots();
    const slot = data.slots.find(s => s.id === slotId);
    if (!slot) return res.status(404).json({ error: 'Slot non trouvé' });

    if (filename) {
      // Verify the file exists
      const filePath = path.join(imagesDir, slot.section, filename);
      if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Fichier introuvable dans cette section' });
      slot.uploadedFile = filename;
    } else {
      slot.uploadedFile = null;
    }
    slot.updatedAt = new Date().toISOString();
    writeSlots(data);

    res.json({
      success: true,
      slot: {
        ...slot,
        currentFile: slot.uploadedFile || slot.originalFile,
        currentUrl: `/images/${slot.section}/${slot.uploadedFile || slot.originalFile}`
      }
    });
  } catch (error) {
    console.error('Slot assign error:', error);
    res.status(500).json({ error: 'Failed to assign slot' });
  }
});

export { router as imageRouter };
