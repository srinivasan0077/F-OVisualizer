import { useState, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AppBar, Toolbar, Typography, IconButton, Tabs, Tab, Box, Chip, Stack, Badge,
  Dialog, useMediaQuery,
} from '@mui/material';
import {
  DarkMode, LightMode, CloudUpload, ShowChart, Assessment, Compare, TipsAndUpdates,
} from '@mui/icons-material';
import { createAppTheme } from './theme';
import { useData } from './context/DataContext';
import { formatDate } from './utils/parsers';
import FileUpload from './components/FileUpload';
import ParticipantDashboard from './components/ParticipantDashboard';
import BhavcopyDashboard from './components/BhavcopyDashboard';
import ComparisonView from './components/ComparisonView';
import InsightsPanel from './components/InsightsPanel';

export default function App() {
  const { darkMode, setDarkMode, participantData, bhavcopyData, removeParticipantData, removeBhavcopyData } = useData();
  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);
  const [tab, setTab] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const totalFiles = participantData.length + bhavcopyData.length;

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
            </Stack>
          </Box>
        )}

        {/* ─── Tabs ─── */}
        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant={isMobile ? 'scrollable' : 'standard'}
            centered={!isMobile}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab icon={<Assessment />} iconPosition="start" label="Participant OI" />
            <Tab icon={<ShowChart />} iconPosition="start" label="Bhavcopy" />
            <Tab icon={<Compare />} iconPosition="start" label="Comparison" />
            <Tab icon={<TipsAndUpdates />} iconPosition="start" label="Insights" />
          </Tabs>
        </Box>

        {/* ─── Content ─── */}
        <Box sx={{ flex: 1, p: { xs: 1, md: 3 }, overflow: 'auto' }}>
          {totalFiles === 0 ? (
            <FileUpload inline onDone={() => {}} />
          ) : (
            <>
              {tab === 0 && <ParticipantDashboard />}
              {tab === 1 && <BhavcopyDashboard />}
              {tab === 2 && <ComparisonView />}
              {tab === 3 && <InsightsPanel />}
            </>
          )}
        </Box>
      </Box>

      {/* ─── Upload dialog ─── */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <FileUpload inline={false} onDone={() => setUploadOpen(false)} />
      </Dialog>
    </ThemeProvider>
  );
}
