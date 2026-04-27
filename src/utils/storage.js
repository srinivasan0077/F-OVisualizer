/* ───────── Storage Layer ───────── */
/* Big data (participant, bhavcopy, commodity) → Supabase Storage bucket (gzipped)
   Small data (journal, market context, watchlist, settings) → Supabase DB (JSONB) */

import {
  supaUpsert, supaFetchAll, supaDelete, supaClearTable,
  saveFileEntry, loadAllFileEntries, deleteFileEntry, clearBucket,
  TABLES, isSupabaseConfigured,
} from './supabase';

/* ── Row transformers (for small DB-only tables) ── */
function toRow(table, entry) {
  switch (table) {
    case TABLES.watchlist: return { symbol: entry.symbol || entry };
    case TABLES.settings: return { key: entry.key, value: entry.value };
    default: return { date: entry.date, data: entry }; // marketContext, journal
  }
}
function fromRow(table, row) {
  switch (table) {
    case TABLES.watchlist: return row.symbol;
    case TABLES.settings: return { key: row.key, value: row.value };
    default: return row.data || row;
  }
}

/* ───── Generic helpers (small tables: DB only) ───── */
async function saveSmall(table, entry) {
  await supaUpsert(table, toRow(table, entry));
}
async function loadAllSmall(table, sortFn) {
  const rows = await supaFetchAll(table);
  const items = rows.map(r => fromRow(table, r));
  return sortFn ? items.sort(sortFn) : items;
}
async function removeSmall(table, match) {
  await supaDelete(table, match);
}

/* ═══════════════════════════════════════════════════
   FILE-BACKED TABLES (large data → Storage bucket)
   ═══════════════════════════════════════════════════ */

/* ───── Participant Data ───── */
export const saveParticipantData = (entry) => saveFileEntry(TABLES.participant, entry);
export async function loadAllParticipantData() {
  const entries = await loadAllFileEntries(TABLES.participant);
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
export const deleteParticipantData = (date) => deleteFileEntry(TABLES.participant, { date });

/* ───── Bhavcopy Data ───── */
export const saveBhavcopyData = (entry) => saveFileEntry(TABLES.bhavcopy, entry);
export async function loadAllBhavcopyData() {
  const entries = await loadAllFileEntries(TABLES.bhavcopy);
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}
export const deleteBhavcopyData = (date, type) => deleteFileEntry(TABLES.bhavcopy, { date, type });

/* ───── Commodity Data ───── */
export const saveCommodityData = (entry) => saveFileEntry(TABLES.commodity, entry);
export async function loadAllCommodityData() {
  const entries = await loadAllFileEntries(TABLES.commodity);
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
export const deleteCommodityData = (date) => deleteFileEntry(TABLES.commodity, { date });

/* ═══════════════════════════════════════════════════
   DB-ONLY TABLES (small data → JSONB columns)
   ═══════════════════════════════════════════════════ */

/* ───── Settings ───── */
export async function saveSetting(key, value) {
  await supaUpsert(TABLES.settings, { key, value });
}
export async function loadSetting(key, defaultValue) {
  if (!isSupabaseConfigured()) return defaultValue;
  const rows = await supaFetchAll(TABLES.settings);
  const found = rows.find(r => r.key === key);
  return found ? found.value : defaultValue;
}

/* ───── Watchlist ───── */
export const saveWatchlistSymbol = (symbol) => supaUpsert(TABLES.watchlist, { symbol });
export const removeWatchlistSymbol = (symbol) => removeSmall(TABLES.watchlist, { symbol });
export async function loadWatchlist() {
  const rows = await supaFetchAll(TABLES.watchlist);
  return rows.map(r => r.symbol);
}

/* ───── Market Context ───── */
export const saveMarketContext = (entry) => saveSmall(TABLES.marketContext, entry);
export const loadAllMarketContext = () => loadAllSmall(TABLES.marketContext, (a, b) => a.date.localeCompare(b.date));
export const deleteMarketContext = (date) => removeSmall(TABLES.marketContext, { date });

/* ───── Journal Data ───── */
export const saveJournalEntry = (entry) => saveSmall(TABLES.journal, entry);
export const loadAllJournalEntries = () => loadAllSmall(TABLES.journal, (a, b) => a.date.localeCompare(b.date));
export const deleteJournalEntry = (date) => removeSmall(TABLES.journal, { date });

/* ═══════════════════════════════════════════════════
   BULK OPERATIONS
   ═══════════════════════════════════════════════════ */

export async function clearAllData() {
  await Promise.all([
    // File-backed: clear bucket folders + DB metadata
    clearBucket(TABLES.participant), supaClearTable(TABLES.participant),
    clearBucket(TABLES.bhavcopy), supaClearTable(TABLES.bhavcopy),
    clearBucket(TABLES.commodity), supaClearTable(TABLES.commodity),
    // DB-only
    supaClearTable(TABLES.marketContext),
    supaClearTable(TABLES.journal),
  ]);
}

export async function exportAllData() {
  const [participant, bhavcopy, watchlist, marketContext, commodity, journal] = await Promise.all([
    loadAllParticipantData(),
    loadAllBhavcopyData(),
    loadWatchlist(),
    loadAllMarketContext(),
    loadAllCommodityData(),
    loadAllJournalEntries(),
  ]);
  return { participant, bhavcopy, watchlist: watchlist.map(s => ({ symbol: s })), marketContext, commodity, journal, exportedAt: new Date().toISOString() };
}

export async function importAllData(json) {
  const counts = {};
  if (json.participant?.length) { for (const e of json.participant) await saveParticipantData(e); counts.participant = json.participant.length; }
  if (json.bhavcopy?.length) { for (const e of json.bhavcopy) await saveBhavcopyData(e); counts.bhavcopy = json.bhavcopy.length; }
  if (json.commodity?.length) { for (const e of json.commodity) await saveCommodityData(e); counts.commodity = json.commodity.length; }
  if (json.marketContext?.length) { for (const e of json.marketContext) await saveMarketContext(e); counts.marketContext = json.marketContext.length; }
  if (json.journal?.length) { for (const e of json.journal) await saveJournalEntry(e); counts.journal = json.journal.length; }
  if (json.watchlist?.length) { for (const e of json.watchlist) await saveWatchlistSymbol(e.symbol || e); counts.watchlist = json.watchlist.length; }
  return counts;
}

export async function getStoreCounts() {
  const [p, b, c, m, j, w, s] = await Promise.all([
    supaFetchAll(TABLES.participant),
    supaFetchAll(TABLES.bhavcopy),
    supaFetchAll(TABLES.commodity),
    supaFetchAll(TABLES.marketContext),
    supaFetchAll(TABLES.journal),
    supaFetchAll(TABLES.watchlist),
    supaFetchAll(TABLES.settings),
  ]);
  return {
    participantData: p.length,
    bhavcopyData: b.length,
    commodityData: c.length,
    marketContext: m.length,
    journalData: j.length,
    watchlist: w.length,
    settings: s.length,
  };
}
