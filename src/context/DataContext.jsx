import { createContext, useContext, useState, useCallback } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [participantData, setParticipantData] = useState([]);
  const [bhavcopyData, setBhavcopyData] = useState([]);
  const [darkMode, setDarkMode] = useState(true);

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
  }, []);

  const removeParticipantData = useCallback((date) => {
    setParticipantData((prev) => prev.filter((f) => f.date !== date));
  }, []);

  const removeBhavcopyData = useCallback((date, type) => {
    setBhavcopyData((prev) => prev.filter((f) => !(f.date === date && f.type === type)));
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
        darkMode,
        setDarkMode,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
