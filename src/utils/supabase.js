/* ───────── Supabase Cloud Sync Layer ───────── */
import { createClient } from '@supabase/supabase-js';

// Configure these in Settings or via env
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;

export function getSupabase() {
  return supabase;
}

export function initSupabase(url, key) {
  if (!url || !key) return null;
  supabase = createClient(url, key);
  return supabase;
}

export function isSupabaseConfigured() {
  return !!supabase;
}

export function isEnvConfigured() {
  return !!(DEFAULT_URL && DEFAULT_KEY);
}

// Auto-init from env if available
if (DEFAULT_URL && DEFAULT_KEY) {
  initSupabase(DEFAULT_URL, DEFAULT_KEY);
}

/* ───── Table names ───── */
const TABLES = {
  participant: 'participant_data',
  bhavcopy: 'bhavcopy_data',
  commodity: 'commodity_data',
  marketContext: 'market_context',
  journal: 'journal_entries',
  watchlist: 'watchlist',
  settings: 'settings',
};

/* ───── Generic CRUD ───── */

export async function supaUpsert(table, data) {
  if (!supabase) return null;
  const { error } = await supabase.from(table).upsert(data, { onConflict: getConflictKey(table) });
  if (error) console.warn(`Supabase upsert ${table}:`, error.message);
  return error;
}

export async function supaFetchAll(table) {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.warn(`Supabase fetch ${table}:`, error.message); return []; }
  return data || [];
}

export async function supaDelete(table, match) {
  if (!supabase) return;
  let q = supabase.from(table).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q;
  if (error) console.warn(`Supabase delete ${table}:`, error.message);
}

export async function supaClearTable(table) {
  if (!supabase) return;
  // Use a condition that matches all rows
  const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01');
  if (error) console.warn(`Supabase clear ${table}:`, error.message);
}

function getConflictKey(table) {
  switch (table) {
    case TABLES.participant: return 'date';
    case TABLES.bhavcopy: return 'date,type';
    case TABLES.commodity: return 'date';
    case TABLES.marketContext: return 'date';
    case TABLES.journal: return 'date';
    case TABLES.watchlist: return 'symbol';
    case TABLES.settings: return 'key';
    default: return 'id';
  }
}

/* ───── Sync: push all local data to Supabase ───── */
export async function pushToCloud(allData) {
  if (!supabase) throw new Error('Supabase not configured');
  const results = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const data = allData[key];
    if (data && data.length > 0) {
      // Transform to match table schema: wrap in { date, data } or { date, type, data } etc.
      const rows = data.map(entry => toCloudRow(table, entry));
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const err = await supaUpsert(table, chunk);
        if (err) results[key] = `Error: ${err.message}`;
      }
      if (!results[key]) results[key] = `${data.length} rows synced`;
    } else {
      results[key] = 'No data';
    }
  }
  return results;
}

/* ───── Sync: pull all cloud data ───── */
export async function pullFromCloud() {
  if (!supabase) throw new Error('Supabase not configured');
  const result = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const rows = await supaFetchAll(table);
    // Transform back: unwrap { date, data } → full object
    result[key] = rows.map(row => fromCloudRow(table, row));
  }
  return result;
}

/* ───── Row transformers ───── */
function toCloudRow(table, entry) {
  switch (table) {
    case TABLES.participant:
      return { date: entry.date, data: entry };
    case TABLES.bhavcopy:
      return { date: entry.date, type: entry.type, data: entry };
    case TABLES.commodity:
      return { date: entry.date, data: entry };
    case TABLES.marketContext:
      return { date: entry.date, data: entry };
    case TABLES.journal:
      return { date: entry.date, data: entry };
    case TABLES.watchlist:
      return { symbol: entry.symbol || entry };
    case TABLES.settings:
      return { key: entry.key, value: entry.value };
    default:
      return entry;
  }
}

function fromCloudRow(table, row) {
  switch (table) {
    case TABLES.participant:
    case TABLES.bhavcopy:
    case TABLES.commodity:
    case TABLES.marketContext:
    case TABLES.journal:
      return row.data || row;
    case TABLES.watchlist:
      return { symbol: row.symbol };
    case TABLES.settings:
      return { key: row.key, value: row.value };
    default:
      return row;
  }
}

/* ───── Background sync helper (fire & forget) ───── */
export function bgSync(table, entry) {
  if (!supabase) return;
  const row = toCloudRow(table, entry);
  supaUpsert(table, row).catch(() => {});
}

export function bgDelete(table, match) {
  if (!supabase) return;
  supaDelete(table, match).catch(() => {});
}

export { TABLES };
