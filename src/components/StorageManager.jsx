import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Grid, Chip, Stack, Alert, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  Card, CardContent, Divider, IconButton, Tooltip, Tabs, Tab,
  List, ListItem, ListItemText, ListItemSecondaryAction, Checkbox, Paper,
} from '@mui/material';
import {
  Storage, FileDownload, FileUpload, Cloud, Delete, DeleteSweep,
  SelectAll, CheckBox, CheckBoxOutlineBlank,
} from '@mui/icons-material';
import { getStoreCounts, exportAllData, importAllData } from '../utils/storage';
import { isSupabaseConfigured } from '../utils/supabase';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';

const STORE_LABELS = {
  participantData: { label: 'Participant OI', icon: '📊' },
  bhavcopyData: { label: 'Bhavcopy', icon: '📈' },
  commodityData: { label: 'Commodity', icon: '🛢️' },
  marketContext: { label: 'Market Context', icon: '🌍' },
  journalData: { label: 'Journal', icon: '📓' },
  watchlist: { label: 'Watchlist', icon: '⭐' },
  settings: { label: 'Settings', icon: '⚙️' },
};

export default function StorageManager({ open, onClose }) {
  const {
    storageReady, participantData, bhavcopyData, commodityData, marketContextData, journalData,
    removeParticipantData, removeBhavcopyData, removeCommodityData, removeMarketContext, removeJournalEntry,
    clearAll,
  } = useData();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [manageTab, setManageTab] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [bulkDate, setBulkDate] = useState('');

  const refreshCounts = useCallback(async () => {
    try { setCounts(await getStoreCounts()); } catch { setCounts({}); }
  }, []);

  useEffect(() => {
    if (open && storageReady) refreshCounts();
  }, [open, storageReady, refreshCounts]);

  // Reset selection when tab changes
  useEffect(() => { setSelected(new Set()); setBulkDate(''); }, [manageTab]);

  // Build list items for current tab
  const dataItems = useMemo(() => {
    switch (manageTab) {
      case 0: return participantData.map(f => ({ key: f.date, label: `Participant OI – ${formatDate(f.date)}`, date: f.date, color: 'primary' }));
      case 1: return bhavcopyData.map(f => ({ key: `${f.date}-${f.type}`, label: `${f.type === 'futures' ? 'Futures' : 'Options'} – ${formatDate(f.date)}`, date: f.date, type: f.type, color: 'secondary' }));
      case 2: return commodityData.map(f => ({ key: f.date, label: `Commodity – ${formatDate(f.date)} (${f.totalFutures || 0}F/${f.totalOptions || 0}O)`, date: f.date, color: 'warning' }));
      case 3: return marketContextData.map(f => ({ key: f.date, label: `Market Context – ${formatDate(f.date)}`, date: f.date, color: 'info' }));
      case 4: return journalData.map(f => ({ key: f.date, label: `Journal – ${formatDate(f.date)}`, date: f.date, color: 'success' }));
      default: return [];
    }
  }, [manageTab, participantData, bhavcopyData, commodityData, marketContextData, journalData]);

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(dataItems.map(i => i.key)));
  const selectNone = () => setSelected(new Set());

  const selectBeforeDate = () => {
    if (!bulkDate) return;
    setSelected(new Set(dataItems.filter(i => i.date <= bulkDate).map(i => i.key)));
  };

  const deleteSelected = async () => {
    setLoading(true);
    const items = dataItems.filter(i => selected.has(i.key));
    for (const item of items) {
      switch (manageTab) {
        case 0: await removeParticipantData(item.date); break;
        case 1: await removeBhavcopyData(item.date, item.type); break;
        case 2: await removeCommodityData(item.date); break;
        case 3: await removeMarketContext(item.date); break;
        case 4: await removeJournalEntry(item.date); break;
      }
    }
    setSelected(new Set());
    setMessage({ type: 'success', text: `Deleted ${items.length} entries` });
    refreshCounts();
    setLoading(false);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fno-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (e) { setMessage({ type: 'error', text: `Export failed: ${e.message}` }); }
    setLoading(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setLoading(true);
      try {
        const data = JSON.parse(await file.text());
        const c = await importAllData(data);
        setMessage({ type: 'success', text: `Imported: ${Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(', ')}` });
        refreshCounts();
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) { setMessage({ type: 'error', text: `Import failed: ${e.message}` }); }
      setLoading(false);
    };
    input.click();
  };

  const totalRecords = Object.values(counts).reduce((s, v) => s + v, 0);
  const connected = isSupabaseConfigured();
  const tabLabels = ['Participant OI', 'Bhavcopy', 'Commodity', 'Market Context', 'Journal'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Storage /> Storage Manager
      </DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {message && <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}

        {/* Connection status */}
        <Alert severity={connected ? 'success' : 'error'} icon={<Cloud />} sx={{ mb: 2 }} variant="outlined">
          {connected
            ? `✅ Supabase connected — ${totalRecords} total records`
            : '❌ Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'}
        </Alert>

        {/* Store Counts */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {Object.entries(STORE_LABELS).map(([key, meta]) => (
            <Grid item xs={4} sm={3} md={12/7} key={key}>
              <Card variant="outlined" sx={{ textAlign: 'center' }}>
                <CardContent sx={{ py: 0.5, px: 1, '&:last-child': { pb: 0.5 } }}>
                  <Typography variant="caption" noWrap>{meta.icon} {meta.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{counts[key] || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* ─── Data Manager ─── */}
        <Typography variant="subtitle2" gutterBottom>🗂️ Manage Data</Typography>
        <Tabs value={manageTab} onChange={(_, v) => setManageTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 1 }}>
          {tabLabels.map((l, i) => <Tab key={i} label={`${l} (${[participantData, bhavcopyData, commodityData, marketContextData, journalData][i].length})`} sx={{ textTransform: 'none', minHeight: 36, py: 0 }} />)}
        </Tabs>

        {/* Bulk actions */}
        <Paper variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" onClick={selectAll} startIcon={<SelectAll />}>All</Button>
          <Button size="small" onClick={selectNone}>None</Button>
          <Divider orientation="vertical" flexItem />
          <TextField size="small" type="date" label="Select before date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ width: 180 }} />
          <Button size="small" onClick={selectBeforeDate} disabled={!bulkDate} variant="outlined">Select</Button>
          <Box sx={{ flexGrow: 1 }} />
          {selected.size > 0 && (
            <Button size="small" color="error" variant="contained" startIcon={<Delete />} onClick={deleteSelected} disabled={loading}>
              Delete {selected.size} selected
            </Button>
          )}
        </Paper>

        {/* Item list */}
        <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto' }}>
          {dataItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>No data in this category</Typography>
          ) : (
            <List dense disablePadding>
              {dataItems.map(item => (
                <ListItem key={item.key} button onClick={() => toggleSelect(item.key)}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: selected.has(item.key) ? 'action.selected' : 'transparent' }}>
                  <Checkbox size="small" checked={selected.has(item.key)} sx={{ mr: 1 }} />
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton size="small" color="error" onClick={(e) => {
                      e.stopPropagation();
                      switch (manageTab) {
                        case 0: removeParticipantData(item.date); break;
                        case 1: removeBhavcopyData(item.date, item.type); break;
                        case 2: removeCommodityData(item.date); break;
                        case 3: removeMarketContext(item.date); break;
                        case 4: removeJournalEntry(item.date); break;
                      }
                      refreshCounts();
                    }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* JSON Export/Import */}
        <Typography variant="subtitle2" gutterBottom>📁 JSON Backup</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport} disabled={loading}>Export JSON</Button>
          <Button variant="outlined" startIcon={<FileUpload />} onClick={handleImport} disabled={loading}>Import JSON</Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
