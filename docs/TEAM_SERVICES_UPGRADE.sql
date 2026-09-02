-- À exécuter une seule fois dans le SQL Editor Supabase pour les bases existantes.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'office';

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_group_type_check;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_group_type_check
  CHECK (group_type IN ('office', 'field'));

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS image_slot TEXT;

ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS video_public_id TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Exemple : placez les membres de chantier dans leur groupe.
-- UPDATE team_members SET group_type = 'field' WHERE id IN ('chef-chantier', 'conducteur-travaux');
