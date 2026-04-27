import { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AppBar, Toolbar, Typography, IconButton, Tabs, Tab, Box, Chip, Stack, Badge,
  Dialog, useMediaQuery, Tooltip, Button,
} from '@mui/material';
import {
  DarkMode, LightMode, CloudUpload, ShowChart, Assessment, Compare, TipsAndUpdates,
  Timeline, Science, Star, Map, DeleteSweep, Public, OilBarrel, LinearScale,
} from '@mui/icons-material';
import { createAppTheme } from './theme';
import { useData } from './context/DataContext';
import { formatDate } from './utils/parsers';
import FileUpload from './components/FileUpload';
import ParticipantDashboard from './components/ParticipantDashboard';
import BhavcopyDashboard from './components/BhavcopyDashboard';
import ComparisonView from './components/ComparisonView';
import InsightsPanel from './components/InsightsPanel';
import MultiDayTrend from './components/MultiDayTrend';
import AdvancedAnalysis from './components/AdvancedAnalysis';
import Watchlist from './components/Watchlist';
import SectorHeatmap from './components/SectorHeatmap';
import SentimentScorecard from './components/SentimentScorecard';
import GlobalMarketContext from './components/GlobalMarketContext';
import CommodityDashboard from './components/CommodityDashboard';
import PivotLevels from './components/PivotLevels';

export default function App() {
  const { darkMode, setDarkMode, participantData, bhavcopyData, commodityData, removeParticipantData, removeBhavcopyData, removeCommodityData, clearAll } = useData();
  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);
  const [tab, setTab] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const totalFiles = participantData.length + bhavcopyData.length + commodityData.length;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '9') { e.preventDefault(); setTab(parseInt(e.key) - 1); }
      if (e.key === '0') { e.preventDefault(); setTab(9); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); setDarkMode(!darkMode); }
      if (e.key === 'u' || e.key === 'U') { e.preventDefault(); setUploadOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [darkMode, setDarkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* ─── App Bar ─── */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <ShowChart sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ flexGrow: 1, color: 'text.primary' }}>
              F&amp;O Visualizer
            </Typography>
            <IconButton onClick={() => setUploadOpen(true)} color="primary">
              <Badge badgeContent={totalFiles} color="secondary" max={99}>
                <CloudUpload />
              </Badge>
            </IconButton>
            {totalFiles > 0 && (
              <Tooltip title="Clear all data">
                <IconButton onClick={() => setClearConfirm(true)} sx={{ ml: 0.5 }} color="error">
                  <DeleteSweep />
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={() => setDarkMode(!darkMode)} sx={{ ml: 1 }}>
              {darkMode ? <LightMode sx={{ color: '#fdd835' }} /> : <DarkMode />}
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* ─── File chips ─── */}
        {totalFiles > 0 && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {participantData.map((f) => (
                <Chip
                  key={`p-${f.date}`}
                  label={`Participant OI – ${formatDate(f.date)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => removeParticipantData(f.date)}
                />
              ))}
              {bhavcopyData.map((f) => (
                <Chip
                  key={`b-${f.date}-${f.type}`}
                  label={`${f.type === 'futures' ? 'Futures' : 'Options'} Bhavcopy – ${formatDate(f.date)}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  onDelete={() => removeBhavcopyData(f.date, f.type)}
                />
              ))}
              {commodityData.map((f) => (
                <Chip
                  key={`c-${f.date}`}
                  label={`Commodity – ${formatDate(f.date)} (${f.totalFutures}F/${f.totalOptions}O)`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  onDelete={() => removeCommodityData(f.date)}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* ─── Tabs ─── */}
        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab icon={<Assessment />} iconPosition="start" label="Participant OI" />
            <Tab icon={<ShowChart />} iconPosition="start" label="Bhavcopy" />
            <Tab icon={<Compare />} iconPosition="start" label="Comparison" />
            <Tab icon={<Timeline />} iconPosition="start" label="Trends" />
            <Tab icon={<Science />} iconPosition="start" label="Advanced" />
            <Tab icon={<Star />} iconPosition="start" label="Watchlist" />
            <Tab icon={<Map />} iconPosition="start" label="Sectors" />
            <Tab icon={<TipsAndUpdates />} iconPosition="start" label="Insights" />
            <Tab icon={<Public />} iconPosition="start" label="Global Context" />
            <Tab icon={<OilBarrel />} iconPosition="start" label="Commodities" />
            <Tab icon={<LinearScale />} iconPosition="start" label="Pivot Levels" />
          </Tabs>
        </Box>

        {/* ─── Content ─── */}
        <Box sx={{ flex: 1, p: { xs: 1, md: 3 }, overflow: 'auto' }}>
          {totalFiles === 0 && tab < 8 ? (
            <FileUpload inline onDone={() => {}} />
          ) : (
            <>
              {/* Sentiment Scorecard — always visible at top (if equity data exists) */}
              {participantData.length > 0 && <SentimentScorecard />}

              {tab === 0 && <ParticipantDashboard />}
              {tab === 1 && <BhavcopyDashboard />}
              {tab === 2 && <ComparisonView />}
              {tab === 3 && <MultiDayTrend />}
              {tab === 4 && <AdvancedAnalysis />}
              {tab === 5 && <Watchlist />}
              {tab === 6 && <SectorHeatmap />}
              {tab === 7 && <InsightsPanel />}
              {tab === 8 && <GlobalMarketContext />}
              {tab === 9 && <CommodityDashboard />}
              {tab === 10 && <PivotLevels />}
            </>
          )}
        </Box>
      </Box>

      {/* ─── Upload dialog ─── */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <FileUpload inline={false} onDone={() => setUploadOpen(false)} />
      </Dialog>

      {/* ─── Clear confirmation dialog ─── */}
      <Dialog open={clearConfirm} onClose={() => setClearConfirm(false)} maxWidth="xs">
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <DeleteSweep sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
          <Typography variant="h6" gutterBottom>Clear All Data?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This will remove all uploaded data from memory and storage. Watchlist will be preserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="outlined" onClick={() => setClearConfirm(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => { clearAll(); setClearConfirm(false); setTab(0); }}
            >
              Clear All
            </Button>
          </Box>
        </Box>
      </Dialog>
    </ThemeProvider>
  );
}
