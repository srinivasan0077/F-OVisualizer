import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  saveParticipantData, loadAllParticipantData, deleteParticipantData,
  saveBhavcopyData, loadAllBhavcopyData, deleteBhavcopyData,
  saveSetting, loadSetting,
  saveWatchlistSymbol, removeWatchlistSymbol as removeWatchlistDB, loadWatchlist,
  saveMarketContext, loadAllMarketContext, deleteMarketContext,
  saveCommodityData, loadAllCommodityData, deleteCommodityData,
  saveJournalEntry, loadAllJournalEntries, deleteJournalEntry,
  clearAllData,
} from '../utils/storage';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [participantData, setParticipantData] = useState([]);
  const [bhavcopyData, setBhavcopyData] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [marketContextData, setMarketContextData] = useState([]);
  const [commodityData, setCommodityData] = useState([]);
  const [journalData, setJournalData] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      try {
        const [pData, bData, dm, wl, mc, cd, jd] = await Promise.all([
          loadAllParticipantData(),
          loadAllBhavcopyData(),
          loadSetting('darkMode', true),
          loadWatchlist(),
          loadAllMarketContext(),
          loadAllCommodityData(),
          loadAllJournalEntries(),
        ]);
        if (pData.length) setParticipantData(pData);
        if (bData.length) setBhavcopyData(bData);
        setDarkMode(dm);
        setWatchlist(wl);
        if (mc.length) setMarketContextData(mc);
        if (cd.length) setCommodityData(cd);
        if (jd.length) setJournalData(jd);
      } catch (e) {
        console.warn('Failed to load persisted data:', e);
      }
      setStorageReady(true);
    })();
  }, []);

  // Persist darkMode changes
  useEffect(() => {
    if (storageReady) saveSetting('darkMode', darkMode).catch(() => {});
  }, [darkMode, storageReady]);

  const addParticipantData = useCallback((entry) => {
    setParticipantData((prev) => {
      const idx = prev.findIndex((f) => f.date === entry.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    saveParticipantData(entry).catch(() => {});
  }, []);

  const addBhavcopyData = useCallback((entry) => {
    setBhavcopyData((prev) => {
      const idx = prev.findIndex((f) => f.date === entry.date && f.type === entry.type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
    });
    saveBhavcopyData(entry).catch(() => {});
  }, []);

  const removeParticipantData = useCallback((date) => {
    setParticipantData((prev) => prev.filter((f) => f.date !== date));
    deleteParticipantData(date).catch(() => {});
  }, []);

  const removeBhavcopyData = useCallback((date, type) => {
    setBhavcopyData((prev) => prev.filter((f) => !(f.date === date && f.type === type)));
    deleteBhavcopyData(date, type).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    setParticipantData([]);
    setBhavcopyData([]);
    await clearAllData().catch(() => {});
  }, []);

  // Watchlist
  const addToWatchlist = useCallback((symbol) => {
    setWatchlist((prev) => {
      if (prev.includes(symbol)) return prev;
      return [...prev, symbol].sort();
    });
    saveWatchlistSymbol(symbol).catch(() => {});
  }, []);

  const removeFromWatchlist = useCallback((symbol) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
    removeWatchlistDB(symbol).catch(() => {});
  }, []);

  // Commodity Data
  const addCommodityData = useCallback((entry) => {
    setCommodityData((prev) => {
      const idx = prev.findIndex((f) => f.date === entry.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    saveCommodityData(entry).catch(() => {});
  }, []);

  const removeCommodityData = useCallback((date) => {
    setCommodityData((prev) => prev.filter((f) => f.date !== date));
    deleteCommodityData(date).catch(() => {});
  }, []);

  // Market Context
  const addMarketContext = useCallback((entry) => {
    setMarketContextData((prev) => {
      const idx = prev.findIndex((e) => e.date === entry.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    saveMarketContext(entry).catch(() => {});
  }, []);

  const removeMarketContext = useCallback((date) => {
    setMarketContextData((prev) => prev.filter((e) => e.date !== date));
    deleteMarketContext(date).catch(() => {});
  }, []);

  // Journal
  const addJournalEntry = useCallback((entry) => {
    setJournalData((prev) => {
      const idx = prev.findIndex((e) => e.date === entry.date);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    saveJournalEntry(entry).catch(() => {});
  }, []);

  const removeJournalEntry = useCallback((date) => {
    setJournalData((prev) => prev.filter((e) => e.date !== date));
    deleteJournalEntry(date).catch(() => {});
  }, []);

  return (
    <DataContext.Provider
      value={{
        participantData,
        bhavcopyData,
        addParticipantData,
        addBhavcopyData,
        removeParticipantData,
        removeBhavcopyData,
        clearAll,
        darkMode,
        setDarkMode,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        commodityData,
        addCommodityData,
        removeCommodityData,
        marketContextData,
        addMarketContext,
        removeMarketContext,
        journalData,
        addJournalEntry,
        removeJournalEntry,
        storageReady,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
