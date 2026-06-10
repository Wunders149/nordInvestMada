import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { uploadPdf } from './cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dossierDir = path.join(projectRoot, 'public', 'Dossier');

async function tableExists() {
  try {
    await supabase.from('dossiers').select('id').limit(1);
    return true;
  } catch {
    return false;
  }
}

async function migrateDossiers() {
  console.log('\n=== Migrating existing PDFs to Cloudinary ===\n');

  const exists = await tableExists();
  if (!exists) {
    console.log('  ⚠ The dossiers table does not exist in Supabase.');
    console.log('\n  First, create the table by running this SQL in your Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/oxhjqnqlmhjqhfirpdll/sql/new\n');
    console.log('  CREATE TABLE IF NOT EXISTS dossiers (');
    console.log('    id TEXT PRIMARY KEY,');
    console.log('    name TEXT NOT NULL,');
    console.log('    cloudinary_public_id TEXT,');
    console.log('    cloudinary_url TEXT,');
    console.log('    size INTEGER DEFAULT 0,');
    console.log('    created_at TIMESTAMPTZ DEFAULT now(),');
    console.log('    updated_at TIMESTAMPTZ');
    console.log('  );');
    console.log('  CREATE INDEX IF NOT EXISTS idx_dossiers_created ON dossiers(created_at DESC);');
    console.log('\n  After running the SQL, run this script again.\n');
    return;
  }

  if (!fs.existsSync(dossierDir)) {
    console.log('  No public/Dossier/ directory found. Nothing to migrate.\n');
    return;
  }

  const files = fs.readdirSync(dossierDir).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (!files.length) {
    console.log('  No PDFs found in public/Dossier/. Nothing to migrate.\n');
    return;
  }

  // Check which files are already in DB
  const { data: existing } = await supabase.from('dossiers').select('name');
  const existingNames = new Set((existing || []).map(d => d.name));

  const pending = files.filter(f => !existingNames.has(f));

  if (!pending.length) {
    console.log(`  All ${files.length} PDF(s) already migrated to Cloudinary.\n`);
    console.log('  You can safely remove the files in public/Dossier/.\n');
    return;
  }

  console.log(`  Found ${pending.length} new PDF(s) to migrate (${files.length - pending.length} already done):\n`);

  for (const file of pending) {
    const filePath = path.join(dossierDir, file);
    const buf = fs.readFileSync(filePath);
    const baseName = path.basename(file, '.pdf');
    const publicId = `${baseName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;

    console.log(`  Uploading: ${file}...`);

    let result;
    try {
      result = await uploadPdf(buf, {
        folder: 'dossiers',
        publicId
      });
    } catch (err) {
      console.error(`  ✗ Failed to upload ${file}: ${err.message}`);
      continue;
    }

    const id = `dossier_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const { error: dbError } = await supabase.from('dossiers').insert({
      id,
      name: file,
      cloudinary_public_id: result.public_id,
      cloudinary_url: result.secure_url,
      size: buf.length
    });

    if (dbError) {
      console.error(`  ✗ Failed to save ${file} to database: ${dbError.message}`);
    } else {
      console.log(`  ✓ ${file} → ${result.secure_url}`);
    }
  }

  console.log('\n=== Migration complete! ===\n');
  console.log('  Next steps:');
  console.log('  1. Verify the dossiers load on the website');
  console.log('  2. Once confirmed, remove the old files from public/Dossier/\n');
}

migrateDossiers().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
