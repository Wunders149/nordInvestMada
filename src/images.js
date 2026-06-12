import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth, logActivity } from './auth.js';
import { supabase } from './supabase.js';
import { uploadImage, deleteImage, getCloudinaryUrl, getCloudinaryMapping, setCloudinaryMapping, clearCloudinaryMapping } from './cloudinary.js';
import { broadcast } from './events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images');

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG, WebP, GIF ou SVG.'));
    }
  }
});

function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

async function findSlotsByFile(section, filename) {
  const { data: byUploaded } = await supabase
    .from('image_slots')
    .select('*')
    .eq('section', section)
    .eq('uploaded_file', filename);
  const { data: byOriginal } = await supabase
    .from('image_slots')
    .select('*')
    .eq('section', section)
    .eq('original_file', filename);
  const seen = new Set();
  return [...(byUploaded || []), ...(byOriginal || [])].filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function getLocalUrl(s, filename) {
  return `/images/${s.section}/${filename}`;
}

function mapSlot(s, cloudinaryEntry) {
  const cld = cloudinaryEntry || {};
  const uploadedFile = s.uploaded_file;
  const originalFile = s.original_file;
  const currentFile = cld.uploaded_file || uploadedFile || originalFile || 'placeholder.svg';
  const currentUrl = cld.url || (uploadedFile ? getLocalUrl(s, uploadedFile) : originalFile ? getLocalUrl(s, originalFile) : '/images/placeholder.svg');

  return {
    id: s.id,
    section: s.section,
    label: s.label,
    originalFile,
    original_file: originalFile,
    uploadedFile: uploadedFile,
    uploaded_file: uploadedFile,
    cloudinaryPublicId: cld.public_id || null,
    cloudinaryUrl: cld.url || null,
    updatedAt: s.updated_at,
    updated_at: s.updated_at,
    createdAt: s.created_at,
    created_at: s.created_at,
    currentFile,
    currentUrl
  };
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

    const ext = path.extname(req.file.originalname);
    const sanitized = sanitizeName(path.basename(req.file.originalname, ext));
    const ts = Date.now();
    const publicId = `${sanitized}-${ts}`;
    const filename = `${publicId}${ext}`;

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadImage(req.file.buffer, {
        folder: section,
        publicId,
        mimetype: req.file.mimetype
      });
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr);
      return res.status(500).json({ error: 'Échec de l\'upload vers Cloudinary' });
    }

    const cloudinaryPublicId = cloudinaryResult.public_id;
    const cloudinaryUrl = cloudinaryResult.secure_url;

    if (!req.body.newSlotLabel && !slotId) {
      return res.json({
        success: true,
        url: cloudinaryUrl,
        cloudinaryUrl,
        file: {
          name: filename,
          section,
          size: req.file.size,
          type: ext.slice(1)
        }
      });
    }

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
          original_file: filename,
          label: req.body.newSlotLabel,
          uploaded_file: filename
        });
        await setCloudinaryMapping(id, {
          public_id: cloudinaryPublicId,
          url: cloudinaryUrl,
          uploaded_file: filename
        });
      } catch (dbErr) {
        console.error('Failed to create image slot:', dbErr);
        return res.status(500).json({ error: 'Failed to create slot' });
      }
    } else {
      try {
        const slot = await getImageSlotById(slotId);
        if (!slot) return res.status(404).json({ error: 'Slot introuvable' });
        await updateImageSlot(slotId, { uploaded_file: filename });
        await setCloudinaryMapping(slotId, {
          public_id: cloudinaryPublicId,
          url: cloudinaryUrl,
          uploaded_file: filename
        });
      } catch (dbErr) {
        console.error('Failed to update slot:', dbErr);
        return res.status(500).json({ error: 'Échec de la mise à jour du slot' });
      }
    }

    logActivity('image_upload', `Image uploadée: ${filename} (${section})`, req.admin?.username || 'admin');
    broadcast('images');

    res.json({
      success: true,
      url: cloudinaryUrl,
      cloudinaryUrl,
      file: {
        name: filename,
        section,
        size: req.file.size,
        type: ext.slice(1)
      }
    });
  });
});

// ─── LIST IMAGES (from image_slots + Cloudinary mapping) ───
router.get('/images', requireAuth, async (req, res) => {
  try {
    const slots = await getImageSlots();
    const mapping = await getCloudinaryMapping();
    const result = {};

    for (const s of slots) {
      if (!s.uploaded_file && !s.original_file) continue;

      const cld = mapping[s.id];
      let fileInfo;

      if (cld) {
        fileInfo = {
          name: cld.uploaded_file || s.uploaded_file || s.original_file,
          path: cld.url,
          cloudinaryUrl: cld.url,
          size: cld.bytes || 0,
          type: path.extname(cld.uploaded_file || s.uploaded_file || s.original_file || '').toLowerCase().slice(1),
          lastModified: s.updated_at || s.created_at || new Date().toISOString(),
          slotId: s.id,
          slotLabel: s.label
        };
      } else if (s.uploaded_file || s.original_file) {
        const localFilename = s.uploaded_file || s.original_file;
        const localPath = path.join(imagesDir, s.section, localFilename);
        let stat;
        try { stat = fs.statSync(localPath); } catch { continue; }
        fileInfo = {
          name: localFilename,
          path: `images/${s.section}/${localFilename}`,
          size: stat.size,
          type: path.extname(localFilename).toLowerCase().slice(1),
          lastModified: stat.mtime.toISOString(),
          slotId: s.id,
          slotLabel: s.label
        };
      }

      if (fileInfo) {
        if (!result[s.section]) result[s.section] = [];
        result[s.section].push(fileInfo);
      }
    }

    Object.keys(result).forEach(section => {
      result[section].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
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

    const slots = await findSlotsByFile(section, filename);

    const mapping = await getCloudinaryMapping();

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        const cld = mapping[slot.id];
        if (cld?.public_id) {
          try {
            await deleteImage(cld.public_id);
          } catch (cloudErr) {
            console.error('Cloudinary delete error:', cloudErr);
          }
        }
        await updateImageSlot(slot.id, { uploaded_file: null });
        await setCloudinaryMapping(slot.id, null);
      }
    }

    const localFile = path.join(imagesDir, section, filename);
    if (fs.existsSync(localFile)) {
      fs.unlinkSync(localFile);
    }

    logActivity('image_delete', `Image supprimée: ${filename} (${section})`, req.admin?.username || 'admin');

    res.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ─── RENAME IMAGE (updates slot label + uploaded_file, not Cloudinary public_id) ───
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

    const slots = await findSlotsByFile(section, filename);

    const mapping = await getCloudinaryMapping();

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        const updates = {};
        if (slot.uploaded_file === filename) updates.uploaded_file = newFilename;
        if (slot.original_file === filename) updates.original_file = newFilename;
        if (Object.keys(updates).length > 0) {
          await updateImageSlot(slot.id, updates);
          const cld = mapping[slot.id];
          if (cld?.url) {
            await setCloudinaryMapping(slot.id, { ...cld, uploaded_file: newFilename });
          }
        }
      }
    }

    const localOldPath = path.join(imagesDir, section, filename);
    const localNewPath = path.join(imagesDir, section, newFilename);
    if (fs.existsSync(localOldPath)) {
      try {
        if (fs.existsSync(localNewPath)) fs.unlinkSync(localNewPath);
        fs.renameSync(localOldPath, localNewPath);
      } catch { }
    }

    logActivity('image_rename', `Image renommée: ${filename} → ${newFilename} (${section})`, req.admin?.username || 'admin');

    res.json({
      success: true,
      file: {
        name: newFilename,
        path: `images/${section}/${newFilename}`,
        url: `/images/${section}/${newFilename}`
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

    const ext = path.extname(req.file.originalname);
    const sanitized = sanitizeName(path.basename(req.file.originalname, ext));
    const ts = Date.now();
    const publicId = `${sanitized}-${ts}`;
    const newFilename = `${publicId}${ext}`;

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadImage(req.file.buffer, {
        folder: section,
        publicId,
        mimetype: req.file.mimetype
      });
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr);
      return res.status(500).json({ error: 'Échec de l\'upload vers Cloudinary' });
    }

    const slots = await findSlotsByFile(section, filename);

    const mapping = await getCloudinaryMapping();

    if (slots && slots.length > 0) {
      for (const slot of slots) {
        const cld = mapping[slot.id];
        if (cld?.public_id) {
          try {
            await deleteImage(cld.public_id);
          } catch (cloudErr) {
            console.error('Cloudinary delete error:', cloudErr);
          }
        }
        await updateImageSlot(slot.id, { uploaded_file: newFilename });
        await setCloudinaryMapping(slot.id, {
          public_id: cloudinaryResult.public_id,
          url: cloudinaryResult.secure_url,
          uploaded_file: newFilename
        });
      }
    }

    const localOldPath = path.join(imagesDir, section, filename);
    if (fs.existsSync(localOldPath)) fs.unlinkSync(localOldPath);

    logActivity('image_replace', `Image remplacée: ${filename} → ${newFilename} (${section})`, req.admin?.username || 'admin');

    res.json({
      success: true,
      url: cloudinaryResult.secure_url,
      cloudinaryUrl: cloudinaryResult.secure_url,
      file: {
        name: newFilename,
        path: `images/${section}/${newFilename}`,
        size: req.file.size
      }
    });
  });
});

// ─── GET SLOT ASSIGNMENTS ───
router.get('/images/slots', async (req, res) => {
  try {
    const slots = await getImageSlots();
    const mapping = await getCloudinaryMapping();
    res.json(slots.map(s => mapSlot(s, mapping[s.id])));
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
      const sourceSlots = await findSlotsByFile(slot.section, filename);

      const mapping = await getCloudinaryMapping();
      const sourceMapping = sourceSlots[0] ? mapping[sourceSlots[0].id] : null;

      await updateImageSlot(slotId, { uploaded_file: filename });
      if (sourceMapping) {
        await setCloudinaryMapping(slotId, { ...sourceMapping });
      } else {
        await setCloudinaryMapping(slotId, null);
      }
    } else {
      await updateImageSlot(slotId, { uploaded_file: null });
      await setCloudinaryMapping(slotId, null);
    }

    const updated = await getImageSlotById(slotId);
    const updatedMapping = await getCloudinaryMapping();
    logActivity('slot_assign', `Slot ${slotId} assigné à ${filename || 'aucun'}`, req.admin?.username || 'admin');
    broadcast('images');

    res.json({
      success: true,
      slot: mapSlot(updated, updatedMapping[slotId])
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
    broadcast('images');

    res.status(201).json({
      success: true,
      slot: mapSlot(slot, null)
    });
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

export { router as imageRouter };
