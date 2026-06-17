import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadImage, getCloudinaryMapping, setCloudinaryMapping, clearCloudinaryMapping } from './cloudinary.js';
import { supabase } from './supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images');

const SKIP_FILES = ['.gitkeep', '.DS_Store', 'Thumbs.db', 'placeholder.svg'];

// These slot IDs are already used in the database and match data-image-slot in index.html
const SLOT_ID_MAP = {
  'hero/architecture.svg': 'hero',
  'hero/architecture-left.svg': 'hero-bg-left',
  'about/team.svg': 'about-team',
  'about/accent.svg': 'about-accent',
  'team/director.svg': 'team-director',
  'team/engineer.svg': 'team-engineer',
  'team/architect.svg': 'team-architect',
  'team/pm.svg': 'team-pm',
  'projects/palas-ramena.svg': 'project-palas-ramena',
  'projects/r1-habitation.svg': 'project-r1-habitation',
  'projects/centre-islamique.svg': 'project-centre-islamique',
  'projects/r2-residentiel.svg': 'project-r2-residentiel',
  'projects/domes-geodesiques.svg': 'project-domes-geodesiques',
  'projects/bureaux-communaux.svg': 'project-bureaux-communaux',
  'blog/construction.svg': 'blog-construction',
  'blog/forage.svg': 'blog-forage',
  'blog/immobilier.svg': 'blog-immobilier'
};

const STATIC_ASSETS = [
  { id: 'logo', relPath: 'logo.jpeg', section: 'logos', label: 'Logo' },
  { id: 'standards-safety', relPath: 'standards/safety.svg', section: 'standards', label: 'Sécurité' },
  { id: 'standards-engineering', relPath: 'standards/engineering.svg', section: 'standards', label: 'Ingénierie' },
  { id: 'standards-bim', relPath: 'standards/bim.svg', section: 'standards', label: 'BIM' },
  { id: 'standards-administration', relPath: 'standards/administration.svg', section: 'standards', label: 'Administration' }
];

function humanize(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getMimeType(ext) {
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml'
  };
  return map[ext.toLowerCase()] || 'image/jpeg';
}

async function migrate() {
  console.log('☁️  Cloudinary Migration — Nord Invest Madagascar\n');

  const missingVars = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missingVars.push('CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missingVars.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missingVars.push('CLOUDINARY_API_SECRET');
  if (missingVars.length > 0) {
    console.error('❌ Missing Cloudinary env vars:', missingVars.join(', '));
    process.exit(1);
  }

  await clearCloudinaryMapping();

  const existingMapping = await getCloudinaryMapping();
  const stats = { uploaded: 0, skipped: 0, failed: 0, slotsUpdated: 0, staticDone: 0 };

  // Step 1: Process files in subdirectory sections
  const subdirs = fs.readdirSync(imagesDir).filter(d => {
    const full = path.join(imagesDir, d);
    return fs.statSync(full).isDirectory();
  });

  const staticRelPaths = new Set(STATIC_ASSETS.map(a => a.relPath));

  for (const section of subdirs) {
    const sectionDir = path.join(imagesDir, section);
    const files = fs.readdirSync(sectionDir).filter(f => {
      if (SKIP_FILES.includes(f)) return false;
      return /\.(jpe?g|png|webp|gif|svg)$/i.test(f);
    });

    if (files.length === 0) continue;
    console.log(`\n📁 Section: ${section} (${files.length} files)`);

    for (const filename of files) {
      const relPath = `${section}/${filename}`;
      if (staticRelPaths.has(relPath)) continue; // handled by STATIC_ASSETS
      const slotId = SLOT_ID_MAP[relPath];

      // Skip if already migrated
      const mappingKey = slotId || `${section}-${path.basename(filename, path.extname(filename))}`;
      if (existingMapping[mappingKey]) {
        console.log(`   ⏭  ${filename} — already migrated`);
        stats.skipped++;
        continue;
      }

      const filePath = path.join(sectionDir, filename);
      const ext = path.extname(filename);
      const publicId = path.basename(filename, ext).toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const fileBuffer = fs.readFileSync(filePath);

      try {
        console.log(`   ☁️  Uploading ${filename}...`);
        const result = await uploadImage(fileBuffer, {
          folder: section,
          publicId: `${publicId}-${Date.now()}`,
          mimetype: getMimeType(ext)
        });

        if (slotId) {
          // Update existing slot with uploaded_file
          await supabase.from('image_slots')
            .update({ uploaded_file: filename, updated_at: new Date().toISOString() })
            .eq('id', slotId);
          await setCloudinaryMapping(slotId, {
            public_id: result.public_id,
            url: result.secure_url,
            uploaded_file: filename
          });
          stats.slotsUpdated++;
          console.log(`   ✅ Updated slot: ${slotId}`);
        } else {
          // Create new slot
          const newId = `${section}-${publicId}-${Date.now()}`;
          await supabase.from('image_slots').insert({
            id: newId,
            section,
            original_file: filename,
            label: humanize(publicId),
            uploaded_file: filename
          });
          await setCloudinaryMapping(newId, {
            public_id: result.public_id,
            url: result.secure_url,
            uploaded_file: filename
          });
          stats.slotsUpdated++;
          console.log(`   ✅ Created slot: ${newId}`);
        }
        stats.uploaded++;
      } catch (err) {
        console.error(`   ❌ Failed: ${filename} — ${err.message}`);
        stats.failed++;
      }
    }
  }

  // Step 2: Process static assets (logo, standards)
  console.log('\n📁 Static assets (logo + standards)');

  for (const asset of STATIC_ASSETS) {
    if (existingMapping[asset.id]) {
      console.log(`   ⏭  ${asset.id} — already migrated`);
      stats.skipped++;
      continue;
    }

    const assetPath = path.join(imagesDir, asset.relPath);
    if (!fs.existsSync(assetPath)) {
      console.log(`   ⏭  ${asset.relPath} — not found on disk`);
      continue;
    }

    const ext = path.extname(asset.relPath);
    const publicId = path.basename(asset.relPath, ext).toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    const fileBuffer = fs.readFileSync(assetPath);

    try {
      console.log(`   ☁️  Uploading ${asset.id} (${asset.relPath})...`);
      const result = await uploadImage(fileBuffer, {
        folder: asset.section,
        publicId: `${publicId}-${Date.now()}`,
        mimetype: getMimeType(ext)
      });

      // Create slot for static asset
      await supabase.from('image_slots').insert({
        id: asset.id,
        section: asset.section,
        original_file: path.basename(asset.relPath),
        label: asset.label,
        uploaded_file: path.basename(asset.relPath)
      });
      await setCloudinaryMapping(asset.id, {
        public_id: result.public_id,
        url: result.secure_url,
        uploaded_file: path.basename(asset.relPath)
      });

      stats.staticDone++;
      stats.uploaded++;
      console.log(`   ✅ Created slot: ${asset.id}`);
    } catch (err) {
      console.error(`   ❌ Failed: ${asset.id} — ${err.message}`);
      stats.failed++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Migration Summary');
  console.log('═══════════════════════════════════════');
  console.log(`   ☁️  Uploaded:      ${stats.uploaded}`);
  console.log(`   ⏭  Skipped:       ${stats.skipped}`);
  console.log(`   ❌ Failed:        ${stats.failed}`);
  console.log(`   🔄 Slots updated: ${stats.slotsUpdated}`);
  console.log(`   📦 Static assets: ${stats.staticDone}`);

  // Get logo URL for OG tag update
  const mapping = await getCloudinaryMapping();
  if (mapping.logo) {
    console.log('\n📋 Next step: Update OG image and JSON-LD URL in index.html:');
    console.log(`   ${mapping.logo.url}`);
  }

  console.log('\n✅ Migration complete!\n');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
