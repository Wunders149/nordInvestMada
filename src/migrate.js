import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, getSiteConfig } from './supabase.js';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');

function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf8');
    return data.trim() ? JSON.parse(data) : null;
  } catch { return null; }
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function migrateContacts() {
  const items = readJSON(path.join(dataDir, 'contacts.json'));
  if (!items || !items.length) { console.log('  No contacts to migrate'); return; }
  const mapped = items.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone || '',
    project_type: c.projectType || c.project_type || '',
    budget: c.budget || '',
    message: c.message,
    service_type: c.serviceType || c.service_type || '',
    date: c.date || new Date().toISOString(),
    read: c.read || false,
    resolved: c.resolved || false,
    notes: c.notes || ''
  }));
  const { error } = await supabase.from('contacts').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Contacts error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} contacts migrated`);
}

async function migrateQuotes() {
  const items = readJSON(path.join(dataDir, 'quotes.json'));
  if (!items || !items.length) { console.log('  No quotes to migrate'); return; }
  const mapped = items.map(q => ({
    id: q.id,
    quote_number: q.quoteNumber || q.quote_number || '',
    name: q.name,
    email: q.email,
    service_type: q.serviceType || q.service_type || '',
    details: q.details || '',
    location: q.location || '',
    date: q.date || new Date().toISOString(),
    status: q.status || 'pending',
    notes: q.notes || ''
  }));
  const { error } = await supabase.from('quotes').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Quotes error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} quotes migrated`);
}

async function migrateSubscribers() {
  const items = readJSON(path.join(dataDir, 'subscribers.json'));
  if (!items || !items.length) { console.log('  No subscribers to migrate'); return; }
  const mapped = items.map(s => ({
    email: s.email,
    date: s.date || new Date().toISOString()
  }));
  const { error } = await supabase.from('subscribers').upsert(mapped, { onConflict: 'email', ignoreDuplicates: false });
  if (error) { console.error('  Subscribers error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} subscribers migrated`);
}

async function migrateTeam() {
  const items = readJSON(path.join(dataDir, 'team.json'));
  if (!items || !items.length) { console.log('  No team members to migrate'); return; }
  const mapped = items.map(t => ({
    id: t.id,
    name: t.name,
    role: t.role || '',
    bio: t.bio || '',
    image_slot: t.image_slot || '',
    order: t.order ?? 99,
    visible: t.visible !== false,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: t.updatedAt || null
  }));
  const { error } = await supabase.from('team_members').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Team error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} team members migrated`);
}

async function migrateServices() {
  const items = readJSON(path.join(dataDir, 'services.json'));
  if (!items || !items.length) { console.log('  No services to migrate'); return; }
  const mapped = items.map(s => ({
    id: s.id,
    title: s.title,
    description: s.description || '',
    icon: s.icon || '',
    order: s.order ?? 99,
    visible: s.visible !== false,
    created_at: s.createdAt || new Date().toISOString(),
    updated_at: s.updatedAt || null
  }));
  const { error } = await supabase.from('services').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Services error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} services migrated`);
}

async function migrateProjects() {
  const items = readJSON(path.join(dataDir, 'projects.json'));
  if (!items || !items.length) { console.log('  No projects to migrate'); return; }
  const mapped = items.map(p => ({
    id: p.id,
    title: p.title,
    location: p.location || '',
    description: p.description || '',
    images: p.images || [],
    category: p.category || '',
    order: p.order ?? 99,
    visible: p.visible !== false,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: p.updatedAt || null
  }));
  const { error } = await supabase.from('projects').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Projects error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} projects migrated`);
}

async function migrateBlog() {
  const items = readJSON(path.join(dataDir, 'blog.json'));
  if (!items || !items.length) { console.log('  No blog posts to migrate'); return; }
  const mapped = items.map(b => ({
    id: b.id,
    title: b.title,
    slug: b.slug || slugify(b.title),
    date: b.date || new Date().toISOString(),
    excerpt: b.excerpt || '',
    content: b.content || '',
    image: b.image || '',
    image_slot: b.image_slot || '',
    published: b.published !== false,
    created_at: b.createdAt || new Date().toISOString(),
    updated_at: b.updatedAt || null
  }));
  const { error } = await supabase.from('blog_posts').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Blog error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} blog posts migrated`);
}

async function migrateActivityLogs() {
  const items = readJSON(path.join(dataDir, 'activity.json'));
  if (!items || !items.length) { console.log('  No activity logs to migrate'); return; }
  const mapped = items.map(l => ({
    id: l.id,
    action: l.action,
    details: l.details || '',
    username: l.username || 'admin',
    timestamp: l.timestamp || new Date().toISOString()
  }));
  const { error } = await supabase.from('activity_logs').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Activity logs error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} activity logs migrated`);
}

async function migrateImageSlots() {
  const items = readJSON(path.join(dataDir, 'image-slots.json'));
  if (!items || !items.slots || !items.slots.length) { console.log('  No image slots to migrate'); return; }
  const mapped = items.slots.map(s => ({
    id: s.id,
    section: s.section,
    original_file: s.originalFile || null,
    label: s.label,
    uploaded_file: s.uploadedFile || null,
    updated_at: s.updatedAt || null,
    created_at: s.createdAt || new Date().toISOString()
  }));
  const { error } = await supabase.from('image_slots').upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) { console.error('  Image slots error:', error.message); return; }
  console.log(`  ✓ ${mapped.length} image slots migrated`);
}

async function migrateSiteConfig() {
  const configPath = path.join(projectRoot, 'config.json');
  const cfg = readJSON(configPath);
  if (!cfg) { console.log('  No config.json to migrate'); return; }

  const existing = await getSiteConfig();
  if (existing && existing.id) {
    console.log('  Site config already exists, skipping');
    return;
  }

  const payload = {
    id: 1,
    contact: cfg.contact || {},
    social: cfg.social || {},
    mission: cfg.mission || '',
    vision: cfg.vision || '',
    team_stats: cfg.team || {},
    founded: cfg.founded || 2015,
    experience_years: cfg.experience_years || 10,
    pricing: cfg.pricing || {},
    contingency_rate: cfg.contingency_rate ?? 0.1,
    tax_rate: cfg.tax_rate ?? 0.2,
    locations: cfg.locations || [],
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('site_config').upsert(payload, { onConflict: 'id' });
  if (error) { console.error('  Site config error:', error.message); return; }
  console.log('  ✓ Site config migrated');
}

async function createAdminUser() {
  const { data: existing } = await supabase.from('admin_users').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('  Admin user already exists, skipping');
    return;
  }

  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'nordinvest2026';
  const passwordHash = await hashPassword(password);

  const { error } = await supabase.from('admin_users').insert({
    username,
    password_hash: passwordHash
  });
  if (error) { console.error('  Admin user error:', error.message); return; }
  console.log(`  ✓ Admin user created (${username}/${password})`);
}

async function main() {
  console.log('\n=== Nord Invest Madagascar — Supabase Migration ===\n');

  console.log('Migrating contacts...');
  await migrateContacts();

  console.log('Migrating quotes...');
  await migrateQuotes();

  console.log('Migrating subscribers...');
  await migrateSubscribers();

  console.log('Migrating team members...');
  await migrateTeam();

  console.log('Migrating services...');
  await migrateServices();

  console.log('Migrating projects...');
  await migrateProjects();

  console.log('Migrating blog posts...');
  await migrateBlog();

  console.log('Migrating activity logs...');
  await migrateActivityLogs();

  console.log('Migrating image slots...');
  await migrateImageSlots();

  console.log('Migrating site config...');
  await migrateSiteConfig();

  console.log('Setting up admin user...');
  await createAdminUser();

  console.log('\n=== Migration complete! ===\n');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
