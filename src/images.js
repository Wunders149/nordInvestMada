import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth, logActivity } from './auth.js';
import { supabase } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images');

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

async function getImageSlots() {
  const { data, error } = await supabase.from('image_slots').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('Failed to load image slots:', error);
    return [];
  }
  return data || [];
}

async function getImageSlotById(id) {
  const { data, error } = await supabase.from('image_slots').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

async function createImageSlot(data) {
  const { data: result, error } = await supabase.from('image_slots').insert(data).select().single();
  if (error) throw error;
  return result;
}

async function updateImageSlot(id, data) {
  data.updated_at = new Date().toISOString();
  const { data: result, error } = await supabase.from('image_slots').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

async function deleteImageSlot(id) {
  const { error } = await supabase.from('image_slots').delete().eq('id', id);
  if (error) throw error;
  return true;
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

    if (req.body.newSlotLabel) {
      const slug = req.body.newSlotLabel
        .toLowerCase()
        .replace(/[^a-z0-9-\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const id = `${section}-${slug}-${Date.now()}`;
      try {
        await createImageSlot({
          id,
          section,
          original_file: req.file.filename,
          label: req.body.newSlotLabel,
          uploaded_file: req.file.filename
        });
      } catch (dbErr) {
        console.error('Failed to create image slot:', dbErr);
        return res.status(500).json({ error: 'Failed to create slot' });
      }
    } else if (slotId) {
      try {
        const slot = await getImageSlotById(slotId);
        if (slot) {
          await updateImageSlot(slotId, { uploaded_file: req.file.filename });
        }
      } catch (dbErr) {
        console.error('Failed to update slot:', dbErr);
      }
    }

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
router.delete('/images/:section/:filename', requireAuth, async (req, res) => {
  try {
    const { section, filename } = req.params;
    if (section.includes('..') || filename.includes('..') || section.includes('/') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const filePath = path.join(imagesDir, section, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé' });

    fs.unlinkSync(filePath);

    const { data: slots } = await supabase
      .from('image_slots')
      .select('id')
      .eq('section', section)
      .eq('uploaded_file', filename);

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        await updateImageSlot(slot.id, { uploaded_file: null });
      }
    }

    logActivity('image_delete', `Image supprimée: ${filename} (${section})`, req.admin?.username || 'admin');

    res.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ─── RENAME IMAGE ───
router.put('/images/:section/:filename/rename', requireAuth, async (req, res) => {
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

    const { data: slots } = await supabase
      .from('image_slots')
      .select('*')
      .eq('section', section)
      .or(`uploaded_file.eq.${filename},original_file.eq.${filename}`);

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        const updates = {};
        if (slot.uploaded_file === filename) updates.uploaded_file = newFilename;
        if (slot.original_file === filename) updates.original_file = newFilename;
        if (Object.keys(updates).length > 0) {
          await updateImageSlot(slot.id, updates);
        }
      }
    }

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

    const { data: slots } = await supabase
      .from('image_slots')
      .select('id')
      .eq('section', section)
      .eq('uploaded_file', filename);

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        await updateImageSlot(slot.id, { uploaded_file: req.file.filename });
      }
    }

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
router.get('/images/slots', async (req, res) => {
  try {
    const slots = await getImageSlots();
    const result = slots.map(s => ({
      id: s.id,
      section: s.section,
      label: s.label,
      originalFile: s.original_file,
      original_file: s.original_file,
      uploadedFile: s.uploaded_file,
      uploaded_file: s.uploaded_file,
      updatedAt: s.updated_at,
      updated_at: s.updated_at,
      createdAt: s.created_at,
      created_at: s.created_at,
      currentFile: s.uploaded_file || s.original_file || 'placeholder.svg',
      currentUrl: `/images/${s.section}/${s.uploaded_file || s.original_file || 'placeholder.svg'}`
    }));
    res.json(result);
  } catch (error) {
    console.error('Slots error:', error);
    res.status(500).json({ error: 'Failed to load slots' });
  }
});

// ─── ASSIGN IMAGE TO SLOT ───
router.put('/images/slots/:slotId', requireAuth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { filename } = req.body;

    const slot = await getImageSlotById(slotId);
    if (!slot) return res.status(404).json({ error: 'Slot non trouvé' });

    if (filename) {
      const filePath = path.join(imagesDir, slot.section, filename);
      if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Fichier introuvable dans cette section' });
      await updateImageSlot(slotId, { uploaded_file: filename });
    } else {
      await updateImageSlot(slotId, { uploaded_file: null });
    }

    const updated = await getImageSlotById(slotId);
    logActivity('slot_assign', `Slot ${slotId} assigné à ${filename || 'aucun'}`, req.admin?.username || 'admin');

    res.json({
      success: true,
      slot: {
        id: updated.id,
        section: updated.section,
        label: updated.label,
        originalFile: updated.original_file,
        original_file: updated.original_file,
        uploadedFile: updated.uploaded_file,
        uploaded_file: updated.uploaded_file,
        updatedAt: updated.updated_at,
        updated_at: updated.updated_at,
        createdAt: updated.created_at,
        created_at: updated.created_at,
        currentFile: updated.uploaded_file || updated.original_file || 'placeholder.svg',
        currentUrl: `/images/${updated.section}/${updated.uploaded_file || updated.original_file || 'placeholder.svg'}`
      }
    });
  } catch (error) {
    console.error('Slot assign error:', error);
    res.status(500).json({ error: 'Failed to assign slot' });
  }
});

// ─── CREATE NEW SLOT ───
router.post('/images/slots', requireAuth, async (req, res) => {
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

    const slot = await createImageSlot({
      id,
      section,
      original_file: null,
      label,
      uploaded_file: null
    });

    logActivity('slot_create', `Slot créé: ${label} (${section})`, req.admin?.username || 'admin');

    res.status(201).json({
      success: true,
      slot: {
        id: slot.id,
        section: slot.section,
        label: slot.label,
        originalFile: slot.original_file,
        original_file: slot.original_file,
        uploadedFile: slot.uploaded_file,
        uploaded_file: slot.uploaded_file,
        updatedAt: slot.updated_at,
        updated_at: slot.updated_at,
        createdAt: slot.created_at,
        created_at: slot.created_at,
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
