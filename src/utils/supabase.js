/* ───────── Supabase Layer ───────── */
import { createClient } from '@supabase/supabase-js';
import pako from 'pako';

const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let supabase = null;

export function initSupabase(url, key) {
  if (!url || !key) return null;
  supabase = createClient(url, key);
  return supabase;
}
export function isSupabaseConfigured() { return !!supabase; }
export function isEnvConfigured() { return !!(DEFAULT_URL && DEFAULT_KEY); }
if (DEFAULT_URL && DEFAULT_KEY) initSupabase(DEFAULT_URL, DEFAULT_KEY);

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

const BUCKET = 'fno-data';

// Tables that store big data in Storage bucket (not in DB)
const FILE_TABLES = new Set([TABLES.participant, TABLES.bhavcopy, TABLES.commodity]);

/* ───── DB helpers (metadata + small tables) ───── */

export async function supaUpsert(table, data) {
  if (!supabase) return null;
  const { error } = await supabase.from(table).upsert(data, { onConflict: getConflictKey(table) });
  if (error) console.warn(`Supabase upsert ${table}:`, error.message);
  return error;
}

export async function supaFetchAll(table) {
  if (!supabase) return [];
  let allData = [], from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) { console.warn(`Supabase fetch ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
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

/* ───── Storage Bucket helpers (for large data files) ───── */

function filePath(table, entry) {
  switch (table) {
    case TABLES.bhavcopy: return `${table}/${entry.date}_${entry.type}.json.gz`;
    default: return `${table}/${entry.date}.json.gz`;
  }
}

export async function uploadFile(table, entry) {
  if (!supabase) return;
  const json = JSON.stringify(entry);
  const compressed = pako.gzip(json);
  const blob = new Blob([compressed], { type: 'application/gzip' });
  const path = filePath(table, entry);

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'application/gzip',
  });
  if (error) console.warn(`Storage upload ${path}:`, error.message);
  return compressed.length; // return file size for metadata
}

export async function downloadFile(path) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) { console.warn(`Storage download ${path}:`, error.message); return null; }
  const buffer = await data.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
  return JSON.parse(decompressed);
}

export async function deleteFile(path) {
  if (!supabase) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn(`Storage delete ${path}:`, error.message);
}

export async function clearBucket(table) {
  if (!supabase) return;
  const { data } = await supabase.storage.from(BUCKET).list(table);
  if (data?.length) {
    const paths = data.map(f => `${table}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

/* ───── High-level: save/load/delete for file-backed tables ───── */

export async function saveFileEntry(table, entry) {
  // 1. Upload data to storage bucket
  const fileSize = await uploadFile(table, entry);
  // 2. Save metadata to DB
  const meta = buildMeta(table, entry, fileSize);
  await supaUpsert(table, meta);
}

export async function loadAllFileEntries(table) {
  // 1. Get metadata from DB
  const metas = await supaFetchAll(table);
  if (!metas.length) return [];
  // 2. Download each file from storage
  const entries = await Promise.all(
    metas.map(async (meta) => {
      const path = metaToPath(table, meta);
      const data = await downloadFile(path);
      return data;
    })
  );
  return entries.filter(Boolean);
}

export async function deleteFileEntry(table, match) {
  // Build path from match
  const path = matchToPath(table, match);
  await deleteFile(path);
  await supaDelete(table, match);
}

function buildMeta(table, entry, fileSize) {
  switch (table) {
    case TABLES.participant:
      return { date: entry.date, record_count: entry.participants?.length || 0, file_size: fileSize || 0 };
    case TABLES.bhavcopy:
      return { date: entry.date, type: entry.type, record_count: entry.records?.length || 0, file_size: fileSize || 0 };
    case TABLES.commodity:
      return { date: entry.date, total_futures: entry.totalFutures || 0, total_options: entry.totalOptions || 0, file_size: fileSize || 0 };
    default:
      return entry;
  }
}

function metaToPath(table, meta) {
  switch (table) {
    case TABLES.bhavcopy: return `${table}/${meta.date}_${meta.type}.json.gz`;
    default: return `${table}/${meta.date}.json.gz`;
  }
}

function matchToPath(table, match) {
  switch (table) {
    case TABLES.bhavcopy: return `${table}/${match.date}_${match.type}.json.gz`;
    default: return `${table}/${match.date}.json.gz`;
  }
}

export { TABLES, BUCKET, FILE_TABLES };
