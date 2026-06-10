// Run this SQL in your Supabase Dashboard SQL Editor:
// https://supabase.com/dashboard/project/oxhjqnqlmhjqhfirpdll/sql/new

const sql = `-- 14. DOSSIERS (PDF documents hosted on Cloudinary)
CREATE TABLE IF NOT EXISTS dossiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cloudinary_public_id TEXT,
  cloudinary_url TEXT,
  size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dossiers_created ON dossiers(created_at DESC);`;

console.log('Copy and paste this SQL into your Supabase SQL Editor:\n');
console.log(sql);
