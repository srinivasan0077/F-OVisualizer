/* ───────── Storage Layer (Supabase Only) ───────── */
import { supaUpsert, supaFetchAll, supaDelete, supaClearTable, TABLES, isSupabaseConfigured } from './supabase';

/* ── Row transformers ── */
function toRow(table, entry) {
  switch (table) {
    case TABLES.bhavcopy: return { date: entry.date, type: entry.type, data: entry };
    case TABLES.watchlist: return { symbol: entry.symbol || entry };
    case TABLES.settings: return { key: entry.key, value: entry.value };
    default: return { date: entry.date, data: entry };
  }
}
function fromRow(table, row) {
  switch (table) {
    case TABLES.watchlist: return row.symbol;
    case TABLES.settings: return { key: row.key, value: row.value };
    default: return row.data || row;
  }
}

/* ───── Generic helpers ───── */
async function save(table, entry) {
  await supaUpsert(table, toRow(table, entry));
}
async function loadAll(table, sortFn) {
  const rows = await supaFetchAll(table);
  const items = rows.map(r => fromRow(table, r));
  return sortFn ? items.sort(sortFn) : items;
}
async function remove(table, match) {
  await supaDelete(table, match);
}

/* ───── Participant Data ───── */
export const saveParticipantData = (entry) => save(TABLES.participant, entry);
export const loadAllParticipantData = () => loadAll(TABLES.participant, (a, b) => a.date.localeCompare(b.date));
export const deleteParticipantData = (date) => remove(TABLES.participant, { date });

/* ───── Bhavcopy Data ───── */
export const saveBhavcopyData = (entry) => save(TABLES.bhavcopy, entry);
export const loadAllBhavcopyData = () => loadAll(TABLES.bhavcopy, (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
export const deleteBhavcopyData = (date, type) => remove(TABLES.bhavcopy, { date, type });

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
export const removeWatchlistSymbol = (symbol) => remove(TABLES.watchlist, { symbol });
export async function loadWatchlist() {
  const rows = await supaFetchAll(TABLES.watchlist);
  return rows.map(r => r.symbol);
}

/* ───── Market Context ───── */
export const saveMarketContext = (entry) => save(TABLES.marketContext, entry);
export const loadAllMarketContext = () => loadAll(TABLES.marketContext, (a, b) => a.date.localeCompare(b.date));
export const deleteMarketContext = (date) => remove(TABLES.marketContext, { date });

/* ───── Commodity Data ───── */
export const saveCommodityData = (entry) => save(TABLES.commodity, entry);
export const loadAllCommodityData = () => loadAll(TABLES.commodity, (a, b) => a.date.localeCompare(b.date));
export const deleteCommodityData = (date) => remove(TABLES.commodity, { date });

/* ───── Journal Data ───── */
export const saveJournalEntry = (entry) => save(TABLES.journal, entry);
export const loadAllJournalEntries = () => loadAll(TABLES.journal, (a, b) => a.date.localeCompare(b.date));
export const deleteJournalEntry = (date) => remove(TABLES.journal, { date });

/* ───── Clear all data ───── */
export async function clearAllData() {
  await Promise.all([
    supaClearTable(TABLES.participant),
    supaClearTable(TABLES.bhavcopy),
    supaClearTable(TABLES.commodity),
    supaClearTable(TABLES.marketContext),
    supaClearTable(TABLES.journal),
  ]);
}

/* ───── Export / Import ───── */
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
