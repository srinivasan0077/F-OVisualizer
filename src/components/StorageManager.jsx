import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, Chip, Stack, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  Card, CardContent, Divider,
} from '@mui/material';
import {
  Storage, FileDownload, FileUpload, Cloud,
} from '@mui/icons-material';
import { getStoreCounts, exportAllData, importAllData } from '../utils/storage';
import { isSupabaseConfigured } from '../utils/supabase';
import { useData } from '../context/DataContext';

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
  const { storageReady } = useData();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const refreshCounts = useCallback(async () => {
    try { setCounts(await getStoreCounts()); } catch { setCounts({}); }
  }, []);

  useEffect(() => {
    if (open && storageReady) refreshCounts();
  }, [open, storageReady, refreshCounts]);

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Storage /> Storage Manager
      </DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {message && <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}

        {/* Connection status */}
        <Alert severity={connected ? 'success' : 'error'} icon={<Cloud />} sx={{ mb: 2 }}>
          {connected
            ? '✅ Connected to Supabase — all data is stored in the cloud automatically.'
            : '❌ Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'}
        </Alert>

        {/* Store Counts */}
        <Typography variant="subtitle2" gutterBottom>Supabase Records ({totalRecords} total)</Typography>
        <Grid container spacing={1} sx={{ mb: 3 }}>
          {Object.entries(STORE_LABELS).map(([key, meta]) => (
            <Grid item xs={6} sm={4} md={3} key={key}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="caption">{meta.icon} {meta.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{counts[key] || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

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
