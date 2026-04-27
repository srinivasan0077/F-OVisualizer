import { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid, Chip, Rating, Divider,
  Card, CardContent, Stack, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  Alert, Slider, Select, MenuItem, FormControl, InputLabel, Badge,
} from '@mui/material';
import {
  Save, Delete, NavigateBefore, NavigateNext, Today, TrendingUp, TrendingDown,
  TrendingFlat, MenuBook, CalendarMonth, BarChart, EmojiEvents, SentimentSatisfied,
  SentimentDissatisfied, SentimentNeutral,
} from '@mui/icons-material';
import { useData } from '../context/DataContext';

const EMOTIONS = ['😤 Frustrated', '😰 Anxious', '😐 Neutral', '🧘 Calm', '😤 Revenge', '🤑 Greedy', '😊 Confident', '🎯 Focused'];
const BIASES = ['Strong Bullish', 'Bullish', 'Neutral', 'Bearish', 'Strong Bearish'];
const TRADE_TYPES = ['Scalp', 'Intraday', 'BTST', 'Swing', 'Positional'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function emptyEntry(date) {
  return {
    date,
    // Pre-market
    bias: 'Neutral',
    confidence: 5,
    keyLevels: '',
    plan: '',
    riskBudget: '',
    watchSymbols: '',
    preMarketNotes: '',
    // Trades
    trades: [],
    // Post-market
    pnl: '',
    pnlPercent: '',
    emotionalState: '😐 Neutral',
    lessonsLearned: '',
    mistakes: '',
    whatWorked: '',
    rating: 3,
    postMarketNotes: '',
  };
}

function emptyTrade() {
  return { symbol: '', type: 'Intraday', side: 'Long', entry: '', exit: '', qty: '', pnl: '', notes: '' };
}

export default function TradingJournal() {
  const { journalData, addJournalEntry, removeJournalEntry } = useData();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [view, setView] = useState('entry'); // entry | calendar | stats

  const entry = useMemo(() => {
    return journalData.find(e => e.date === selectedDate) || emptyEntry(selectedDate);
  }, [journalData, selectedDate]);

  const [form, setForm] = useState(entry);

  // Reset form when date changes
  useMemo(() => { setForm(entry); }, [entry]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addTrade = () => setForm(prev => ({ ...prev, trades: [...(prev.trades || []), emptyTrade()] }));
  const updateTrade = (idx, field, value) => setForm(prev => {
    const trades = [...prev.trades];
    trades[idx] = { ...trades[idx], [field]: value };
    return { ...prev, trades };
  });
  const removeTrade = (idx) => setForm(prev => ({ ...prev, trades: prev.trades.filter((_, i) => i !== idx) }));

  const handleSave = () => addJournalEntry(form);
  const handleDelete = () => { removeJournalEntry(selectedDate); setForm(emptyEntry(selectedDate)); };

  const navigate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Stats
  const stats = useMemo(() => {
    if (!journalData.length) return null;
    const withPnl = journalData.filter(e => e.pnl !== '' && e.pnl !== undefined);
    const totalPnl = withPnl.reduce((s, e) => s + (parseFloat(e.pnl) || 0), 0);
    const wins = withPnl.filter(e => parseFloat(e.pnl) > 0).length;
    const losses = withPnl.filter(e => parseFloat(e.pnl) < 0).length;
    const avgRating = journalData.reduce((s, e) => s + (e.rating || 0), 0) / journalData.length;
    const bestDay = withPnl.reduce((best, e) => (parseFloat(e.pnl) || 0) > (parseFloat(best?.pnl) || -Infinity) ? e : best, null);
    const worstDay = withPnl.reduce((worst, e) => (parseFloat(e.pnl) || 0) < (parseFloat(worst?.pnl) || Infinity) ? e : worst, null);

    // Streak
    let currentStreak = 0;
    for (let i = withPnl.length - 1; i >= 0; i--) {
      if (parseFloat(withPnl[i].pnl) > 0) currentStreak++;
      else break;
    }

    return { totalPnl, wins, losses, avgRating, bestDay, worstDay, totalDays: journalData.length, currentStreak };
  }, [journalData]);

  // Calendar data
  const calendarEntries = useMemo(() => {
    const map = {};
    journalData.forEach(e => { map[e.date] = e; });
    return map;
  }, [journalData]);

  const isExisting = journalData.some(e => e.date === selectedDate);
  const biasColor = { 'Strong Bullish': '#4caf50', Bullish: '#81c784', Neutral: '#90a4b4', Bearish: '#e57373', 'Strong Bearish': '#f44336' };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBook /> Trading Journal
        </Typography>
        <ToggleButtonGroup size="small" value={view} exclusive onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="entry"><Today sx={{ mr: 0.5 }} /> Entry</ToggleButton>
          <ToggleButton value="calendar"><CalendarMonth sx={{ mr: 0.5 }} /> Calendar</ToggleButton>
          <ToggleButton value="stats"><BarChart sx={{ mr: 0.5 }} /> Stats</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Date Nav */}
      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate(-1)}><NavigateBefore /></IconButton>
        <TextField type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} size="small" />
        <IconButton onClick={() => navigate(1)}><NavigateNext /></IconButton>
        <Button size="small" onClick={() => setSelectedDate(todayStr())} startIcon={<Today />}>Today</Button>
        {isExisting && <Chip label="Saved" color="success" size="small" />}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Save</Button>
        {isExisting && <IconButton color="error" onClick={handleDelete}><Delete /></IconButton>}
      </Paper>

      {view === 'entry' && (
        <Grid container spacing={2}>
          {/* ─── Pre-Market ─── */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                🌅 Pre-Market Preparation
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Market Bias</InputLabel>
                    <Select value={form.bias} label="Market Bias" onChange={e => updateField('bias', e.target.value)}>
                      {BIASES.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" gutterBottom>Confidence Level: {form.confidence}/10</Typography>
                  <Slider value={form.confidence} onChange={(_, v) => updateField('confidence', v)} min={1} max={10} marks valueLabelDisplay="auto" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="Risk Budget (₹)" value={form.riskBudget} onChange={e => updateField('riskBudget', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Key Levels (S1, S2, R1, R2)" value={form.keyLevels} onChange={e => updateField('keyLevels', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Watch Symbols" value={form.watchSymbols} onChange={e => updateField('watchSymbols', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={2} size="small" label="Trading Plan" value={form.plan} onChange={e => updateField('plan', e.target.value)} placeholder="What setups are you looking for today?" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={2} size="small" label="Pre-Market Notes" value={form.preMarketNotes} onChange={e => updateField('preMarketNotes', e.target.value)} placeholder="SGX, global cues, news, FII activity..." />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* ─── Trade Log ─── */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'secondary.main' }}>📊 Trade Log</Typography>
                <Button size="small" variant="outlined" onClick={addTrade}>+ Add Trade</Button>
              </Box>
              {(form.trades || []).map((t, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={6} sm={1.5}>
                      <TextField fullWidth size="small" label="Symbol" value={t.symbol} onChange={e => updateTrade(i, 'symbol', e.target.value)} />
                    </Grid>
                    <Grid item xs={6} sm={1.5}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select value={t.type} label="Type" onChange={e => updateTrade(i, 'type', e.target.value)}>
                          {TRADE_TYPES.map(tt => <MenuItem key={tt} value={tt}>{tt}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4} sm={1}>
                      <ToggleButtonGroup size="small" value={t.side} exclusive onChange={(_, v) => v && updateTrade(i, 'side', v)} fullWidth>
                        <ToggleButton value="Long" sx={{ fontSize: '0.7rem' }}>L</ToggleButton>
                        <ToggleButton value="Short" sx={{ fontSize: '0.7rem' }}>S</ToggleButton>
                      </ToggleButtonGroup>
                    </Grid>
                    <Grid item xs={4} sm={1}><TextField fullWidth size="small" label="Entry" value={t.entry} onChange={e => updateTrade(i, 'entry', e.target.value)} /></Grid>
                    <Grid item xs={4} sm={1}><TextField fullWidth size="small" label="Exit" value={t.exit} onChange={e => updateTrade(i, 'exit', e.target.value)} /></Grid>
                    <Grid item xs={4} sm={1}><TextField fullWidth size="small" label="Qty" value={t.qty} onChange={e => updateTrade(i, 'qty', e.target.value)} /></Grid>
                    <Grid item xs={4} sm={1.5}><TextField fullWidth size="small" label="P&L ₹" value={t.pnl} onChange={e => updateTrade(i, 'pnl', e.target.value)} /></Grid>
                    <Grid item xs={8} sm={2}><TextField fullWidth size="small" label="Notes" value={t.notes} onChange={e => updateTrade(i, 'notes', e.target.value)} /></Grid>
                    <Grid item xs={4} sm={0.5}><IconButton size="small" color="error" onClick={() => removeTrade(i)}><Delete /></IconButton></Grid>
                  </Grid>
                </Paper>
              ))}
              {(!form.trades || form.trades.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No trades logged yet. Click "+ Add Trade" to start.
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* ─── Post-Market Review ─── */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                🌙 Post-Market Review
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="Day P&L (₹)" value={form.pnl} onChange={e => updateField('pnl', e.target.value)}
                    sx={{ '& input': { color: parseFloat(form.pnl) >= 0 ? '#4caf50' : '#f44336', fontWeight: 700, fontSize: '1.1rem' } }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="P&L %" value={form.pnlPercent} onChange={e => updateField('pnlPercent', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Emotional State</InputLabel>
                    <Select value={form.emotionalState} label="Emotional State" onChange={e => updateField('emotionalState', e.target.value)}>
                      {EMOTIONS.map(em => <MenuItem key={em} value={em}>{em}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption">Day Rating</Typography>
                  <Rating value={form.rating} onChange={(_, v) => updateField('rating', v)} size="large" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={2} size="small" label="What Worked" value={form.whatWorked} onChange={e => updateField('whatWorked', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth multiline rows={2} size="small" label="Mistakes / Lessons" value={form.mistakes} onChange={e => updateField('mistakes', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={2} size="small" label="Post-Market Notes" value={form.postMarketNotes} onChange={e => updateField('postMarketNotes', e.target.value)} />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {view === 'calendar' && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom><CalendarMonth sx={{ mr: 1 }} />Journal Calendar</Typography>
          <Grid container spacing={1}>
            {(() => {
              const now = new Date(selectedDate);
              const year = now.getFullYear(), month = now.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(<Grid item xs={12/7} key={`empty-${i}`}><Box /></Grid>);
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const ent = calendarEntries[dateStr];
                const pnl = ent ? parseFloat(ent.pnl) || 0 : null;
                cells.push(
                  <Grid item xs={12/7} key={d}>
                    <Paper
                      variant="outlined"
                      onClick={() => { setSelectedDate(dateStr); setView('entry'); }}
                      sx={{
                        p: 1, textAlign: 'center', cursor: 'pointer', minHeight: 60,
                        bgcolor: ent ? (pnl > 0 ? 'rgba(76,175,80,0.15)' : pnl < 0 ? 'rgba(244,67,54,0.15)' : 'rgba(255,255,255,0.05)') : 'transparent',
                        border: dateStr === selectedDate ? '2px solid' : undefined,
                        borderColor: dateStr === selectedDate ? 'primary.main' : undefined,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" fontWeight={700}>{d}</Typography>
                      {ent && (
                        <>
                          <Typography variant="caption" sx={{ color: pnl >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                            {pnl !== 0 ? `₹${pnl.toLocaleString()}` : '—'}
                          </Typography>
                          <br />
                          <Rating value={ent.rating || 0} size="small" readOnly max={5} />
                        </>
                      )}
                    </Paper>
                  </Grid>
                );
              }
              return (
                <>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
                      <IconButton onClick={() => { const d = new Date(year, month - 1, 1); setSelectedDate(d.toISOString().slice(0,10)); }}>
                        <NavigateBefore />
                      </IconButton>
                      <Typography variant="h6">{new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</Typography>
                      <IconButton onClick={() => { const d = new Date(year, month + 1, 1); setSelectedDate(d.toISOString().slice(0,10)); }}>
                        <NavigateNext />
                      </IconButton>
                    </Box>
                    <Grid container spacing={0.5}>
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <Grid item xs={12/7} key={d}><Typography variant="caption" align="center" display="block" fontWeight={700}>{d}</Typography></Grid>
                      ))}
                    </Grid>
                  </Grid>
                  {cells}
                </>
              );
            })()}
          </Grid>
        </Paper>
      )}

      {view === 'stats' && stats && (
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Total P&L</Typography>
              <Typography variant="h5" sx={{ color: stats.totalPnl >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                ₹{stats.totalPnl.toLocaleString()}
              </Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Win Rate</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {stats.wins + stats.losses > 0 ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0) : 0}%
              </Typography>
              <Typography variant="caption">{stats.wins}W / {stats.losses}L</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Journal Days</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.totalDays}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Win Streak 🔥</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>{stats.currentStreak}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Avg Rating</Typography>
              <Rating value={stats.avgRating} readOnly precision={0.1} />
              <Typography variant="body2">{stats.avgRating.toFixed(1)} / 5</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Best Day</Typography>
              <Typography variant="body2" color="success.main" fontWeight={700}>
                {stats.bestDay ? `₹${parseFloat(stats.bestDay.pnl).toLocaleString()}` : '—'}
              </Typography>
              <Typography variant="caption">{stats.bestDay?.date || ''}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption">Worst Day</Typography>
              <Typography variant="body2" color="error.main" fontWeight={700}>
                {stats.worstDay ? `₹${parseFloat(stats.worstDay.pnl).toLocaleString()}` : '—'}
              </Typography>
              <Typography variant="caption">{stats.worstDay?.date || ''}</Typography>
            </CardContent></Card>
          </Grid>
          {/* Equity curve */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>📈 Equity Curve</Typography>
              {(() => {
                const pnlDays = journalData.filter(e => e.pnl !== '' && e.pnl !== undefined);
                if (!pnlDays.length) return <Typography color="text.secondary">No P&L data yet</Typography>;
                let cum = 0;
                const points = pnlDays.map(e => { cum += parseFloat(e.pnl) || 0; return { date: e.date, value: cum }; });
                const max = Math.max(...points.map(p => p.value), 0);
                const min = Math.min(...points.map(p => p.value), 0);
                const range = max - min || 1;
                const w = 100 / points.length;
                return (
                  <Box sx={{ height: 200, position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                    {/* Zero line */}
                    <Box sx={{ position: 'absolute', left: 0, right: 0, top: `${((max - 0) / range) * 100}%`, borderBottom: '1px dashed', borderColor: 'text.secondary', opacity: 0.3 }} />
                    {points.map((p, i) => {
                      const height = Math.abs(p.value) / range * 100;
                      const isPositive = p.value >= 0;
                      const zeroY = (max / range) * 100;
                      return (
                        <Tooltip key={i} title={`${p.date}: ₹${p.value.toLocaleString()}`}>
                          <Box sx={{
                            position: 'absolute', left: `${i * w}%`, width: `${w}%`,
                            top: isPositive ? `${zeroY - height}%` : `${zeroY}%`,
                            height: `${height}%`,
                            bgcolor: isPositive ? 'success.main' : 'error.main', opacity: 0.7,
                          }} />
                        </Tooltip>
                      );
                    })}
                  </Box>
                );
              })()}
            </Paper>
          </Grid>
        </Grid>
      )}

      {view === 'stats' && !stats && (
        <Alert severity="info">Start journaling to see your trading statistics!</Alert>
      )}
    </Box>
  );
}
