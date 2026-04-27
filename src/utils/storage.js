/* ───────── IndexedDB Persistence Layer ───────── */

const DB_NAME = 'fno-visualizer';
const DB_VERSION = 3;
const STORES = {
  participant: 'participantData',
  bhavcopy: 'bhavcopyData',
  settings: 'settings',
  watchlist: 'watchlist',
  marketContext: 'marketContext',
  commodity: 'commodityData',
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.participant))
        db.createObjectStore(STORES.participant, { keyPath: 'date' });
      if (!db.objectStoreNames.contains(STORES.bhavcopy))
        db.createObjectStore(STORES.bhavcopy, { keyPath: ['date', 'type'] });
      if (!db.objectStoreNames.contains(STORES.settings))
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.watchlist))
        db.createObjectStore(STORES.watchlist, { keyPath: 'symbol' });
      if (!db.objectStoreNames.contains(STORES.marketContext))
        db.createObjectStore(STORES.marketContext, { keyPath: 'date' });
      if (!db.objectStoreNames.contains(STORES.commodity))
        db.createObjectStore(STORES.commodity, { keyPath: 'date' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txn(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result.__result ?? undefined);
    tx.onerror = () => reject(tx.error);
    if (result instanceof IDBRequest) {
      result.onsuccess = () => { result.__result = result.result; };
    }
  });
}

/* ───── Participant Data ───── */

export async function saveParticipantData(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.participant, 'readwrite');
    tx.objectStore(STORES.participant).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllParticipantData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.participant, 'readonly');
    const req = tx.objectStore(STORES.participant).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.date.localeCompare(b.date)));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteParticipantData(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.participant, 'readwrite');
    tx.objectStore(STORES.participant).delete(date);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ───── Bhavcopy Data ───── */

export async function saveBhavcopyData(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.bhavcopy, 'readwrite');
    tx.objectStore(STORES.bhavcopy).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllBhavcopyData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.bhavcopy, 'readonly');
    const req = tx.objectStore(STORES.bhavcopy).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBhavcopyData(date, type) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.bhavcopy, 'readwrite');
    tx.objectStore(STORES.bhavcopy).delete([date, type]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ───── Settings ───── */

export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readwrite');
    tx.objectStore(STORES.settings).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSetting(key, defaultValue) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readonly');
    const req = tx.objectStore(STORES.settings).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? defaultValue);
    req.onerror = () => reject(req.error);
  });
}

/* ───── Watchlist ───── */

export async function saveWatchlistSymbol(symbol) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.watchlist, 'readwrite');
    tx.objectStore(STORES.watchlist).put({ symbol });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeWatchlistSymbol(symbol) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.watchlist, 'readwrite');
    tx.objectStore(STORES.watchlist).delete(symbol);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadWatchlist() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.watchlist, 'readonly');
    const req = tx.objectStore(STORES.watchlist).getAll();
    req.onsuccess = () => resolve(req.result.map((r) => r.symbol));
    req.onerror = () => reject(req.error);
  });
}

/* ───── Market Context ───── */

export async function saveMarketContext(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.marketContext, 'readwrite');
    tx.objectStore(STORES.marketContext).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllMarketContext() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.marketContext, 'readonly');
    const req = tx.objectStore(STORES.marketContext).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.date.localeCompare(b.date)));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMarketContext(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.marketContext, 'readwrite');
    tx.objectStore(STORES.marketContext).delete(date);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ───── Commodity Data ───── */

export async function saveCommodityData(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.commodity, 'readwrite');
    tx.objectStore(STORES.commodity).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllCommodityData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.commodity, 'readonly');
    const req = tx.objectStore(STORES.commodity).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.date.localeCompare(b.date)));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCommodityData(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.commodity, 'readwrite');
    tx.objectStore(STORES.commodity).delete(date);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ───── Clear all data ───── */

export async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeNames = [STORES.participant, STORES.bhavcopy];
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
