-- ═══════════════════════════════════════════════════════════════
-- NORD INVEST MADAGASCAR — Supabase Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. ADMIN USERS (replaces env-based auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CONTACTS (contact form submissions)
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_type TEXT,
  budget TEXT,
  message TEXT NOT NULL,
  service_type TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  notes TEXT DEFAULT ''
);
CREATE INDEX idx_contacts_date ON contacts(date DESC);

-- 3. QUOTES (quote requests)
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  service_type TEXT,
  details TEXT,
  location TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT ''
);
CREATE INDEX idx_quotes_date ON quotes(date DESC);

-- 4. SUBSCRIBERS (newsletter)
CREATE TABLE subscribers (
  email TEXT PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_subscribers_date ON subscribers(date DESC);

-- 5. TEAM MEMBERS
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  image_slot TEXT,
  "order" INTEGER DEFAULT 99,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 6. SERVICES
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  "order" INTEGER DEFAULT 99,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 7. PROJECTS
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  image_slot TEXT,
  category TEXT,
  "order" INTEGER DEFAULT 99,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 8. BLOG POSTS
CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  date TIMESTAMPTZ DEFAULT now(),
  excerpt TEXT,
  content TEXT,
  image TEXT,
  image_slot TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX idx_blog_date ON blog_posts(date DESC);

-- 9. ACTIVITY LOGS
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  username TEXT DEFAULT 'admin',
  timestamp TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_timestamp ON activity_logs(timestamp DESC);

-- 10. IMAGE SLOTS
-- Cloudinary mapping stored in `settings` table under key 'cloudinary_mapping'
CREATE TABLE image_slots (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  original_file TEXT,
  label TEXT NOT NULL,
  uploaded_file TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_image_slots_section ON image_slots(section);

-- 11. SETTINGS (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. SESSIONS (persistent admin login sessions)
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_expires ON sessions(expires);

-- 13. SITE CONFIG (replaces config.json mutable parts)
CREATE TABLE site_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton row
  contact JSONB,
  social JSONB,
  mission TEXT,
  vision TEXT,
  team_stats JSONB,  -- { total_staff, civil_engineers, technicians }
  founded INTEGER,
  experience_years INTEGER,
  pricing JSONB,     -- full pricing grid
  contingency_rate REAL DEFAULT 0.1,
  tax_rate REAL DEFAULT 0.2,
  locations JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default site_config row
INSERT INTO site_config (id, contact, social, mission, vision, team_stats, founded, experience_years, pricing, locations)
VALUES (
  1,
  '{"phone":"032 82 312 80 / 037 07 396 07","email":"nordinvestmada@gmail.com","address":"Tanambao 1 en face de Madahoufi, rue comores, Antsiranana, Madagascar"}'::jsonb,
  '{"facebook":"https://www.facebook.com/nordinvest","instagram":"https://www.instagram.com/nordinvest"}'::jsonb,
  'Réaliser des études, des travaux de construction et des services immobiliers avec professionnalisme, qualité et respect des normes.',
  'Devenir un acteur de référence dans le secteur du bâtiment et de l''immobilier à Madagascar et en Afrique.',
  '{"total_staff":34,"civil_engineers":4,"technicians":30}'::jsonb,
  2015, 10,
  '{"construction":{"economic":{"name":"Économique","pricePerM2":400000,"unit":"m²","features":["Fondations et dallage","Murs porteurs en parpaing","Toiture en tôle bac acier","Enduit ciment extérieur","Menuiserie simple","Installation électrique de base"]},"standard":{"name":"Standard","pricePerM2":850000,"unit":"m²","features":["Fondations renforcées","Murs porteurs + cloisons","Toiture charpente bois + tuiles","Carrelage au choix","Plomberie complète","Électricité encastrée","Menuiserie aluminium","Peinture intérieure complète"]},"premium":{"name":"Premium","pricePerM2":1600000,"unit":"m²","features":["Architecture personnalisée","Matériaux nobles (pierre, bois précieux)","Doubles vitrages","Climatisation intégrée","Domotique et smart home","Piscine et aménagements extérieurs","Plafond tendu ou décoratif","Salle de bain haut de gamme"]}},"rehabilitation":{"economic":{"name":"Rafraîchissement","pricePerM2":200000,"unit":"m²","features":["Peinture intérieure complète","Réparation des fissures","Nettoyage en profondeur","Remplacement des prises et interrupteurs","Petites réparations plomberie"]},"standard":{"name":"Rénovation Complète","pricePerM2":550000,"unit":"m²","features":["Reprise électricité complète","Plomberie intégrale","Carrelage et revêtements neufs","Menuiserie intérieure neuve","Toiture et étanchéité","Enduits et peinture"]},"premium":{"name":"Confortement & Extension","pricePerM2":1000000,"unit":"m²","features":["Extension de surface habitable","Confortement structurel (poteaux, poutres)","Finition haut de gamme","Isolation thermique et acoustique","Véranda ou terrasse couverte","Permis de construire inclus"]}},"forage":{"economic":{"name":"Géophysique Préalable","price":3500000,"unit":"mission","features":["Prospection électrique verticale","Carte piézométrique","Rapport de potentiel aquifère","Recommandations forage","Délai : 5 jours ouvrés"]},"standard":{"name":"Forage + Équipement","pricePerML":300000,"unit":"ml","features":["Foration tubée complète","Tubage PVC ou acier","Développement et nettoyage","Pompe immergée + motopompe","Essai de débit 24h","Installation électrique de surface","Garantie 1 an"]},"premium":{"name":"Entretien & Réhabilitation","price":5500000,"unit":"mission","features":["Diagnostic complet du forage","Réhabilitation des crépines","Remplacement pompe et câbles","Traitement chimique anti-bactérien","Nouvel essai de débit","Rapport technique détaillé","Garantie 6 mois"]}}}'::jsonb,
  '[{"name":"Diego Suarez (Antsiranana)","code":"diego-suarez","region":"Diana","multiplier":1},{"name":"Nosy Be","code":"nosy-be","region":"Diana","multiplier":1.15},{"name":"Sambava","code":"sambava","region":"SAVA","multiplier":1.05},{"name":"Antalaha","code":"antalaha","region":"SAVA","multiplier":1.08}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
