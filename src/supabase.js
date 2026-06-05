import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function list(table, options = {}) {
  let query = supabase.from(table).select(options.select || '*');
  if (options.filters) {
    for (const [col, val] of Object.entries(options.filters)) {
      query = query.eq(col, val);
    }
  }
  if (options.order) {
    for (const ord of options.order) {
      const [col, dir] = Array.isArray(ord) ? ord : [ord, 'asc'];
      query = query.order(col, { ascending: dir === 'asc' });
    }
  }
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function get(table, id, idColumn = 'id') {
  const { data, error } = await supabase.from(table).select('*').eq(idColumn, id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function create(table, data) {
  const { data: result, error } = await supabase.from(table).insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function update(table, id, data, idColumn = 'id') {
  const { data: result, error } = await supabase.from(table).update(data).eq(idColumn, id).select().single();
  if (error) throw error;
  return result;
}

export async function remove(table, id, idColumn = 'id') {
  const { error } = await supabase.from(table).delete().eq(idColumn, id);
  if (error) throw error;
  return true;
}

export async function getSiteConfig() {
  const { data, error } = await supabase.from('site_config').select('*').eq('id', 1).single();
  if (error) {
    if (error.code === 'PGRST116') return {};
    throw error;
  }
  return data || {};
}

export async function upsertSiteConfig(data) {
  data.id = 1;
  data.updated_at = new Date().toISOString();
  const { error } = await supabase.from('site_config').upsert(data, { onConflict: 'id' });
  if (error) throw error;
  return true;
}

export async function logActivity(action, details, username) {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from('activity_logs').insert({
      id,
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      username: username || 'admin',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Activity log write failed:', err.message);
  }
}

export async function getSetting(key) {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data?.value;
}

export async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
  return true;
}

export async function getAllSettings() {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const result = {};
  for (const row of (data || [])) {
    result[row.key] = row.value;
  }
  return result;
}
