import { useState, useMemo, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, TextField, Button, Chip,
  Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, ToggleButtonGroup, ToggleButton, CircularProgress, Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Calculate, Refresh, TrendingUp, TrendingDown, Remove, LinearScale,
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';

/* ───── CPR Calculation ───── */
function calculateCPR(high, low, close) {
  const pivot = (high + low + close) / 3;
  const bc_raw = (high + low) / 2;
  const tc_raw = 2 * pivot - bc_raw;
  // TC must always be above BC — swap if needed (happens when close < midpoint)
  const tc = Math.max(tc_raw, bc_raw);
  const bc = Math.min(tc_raw, bc_raw);
  const r1 = 2 * pivot - low;
  const r2 = pivot + (high - low);
  const r3 = high + 2 * (pivot - low);
  const r4 = r3 + (high - low);
  const s1 = 2 * pivot - high;
  const s2 = pivot - (high - low);
  const s3 = low - 2 * (high - low);
  const s4 = s3 - (high - low);

  return {
    pivot: +pivot.toFixed(2),
    tc: +tc.toFixed(2),
    bc: +bc.toFixed(2),
    r1: +r1.toFixed(2), r2: +r2.toFixed(2), r3: +r3.toFixed(2), r4: +r4.toFixed(2),
    s1: +s1.toFixed(2), s2: +s2.toFixed(2), s3: +s3.toFixed(2), s4: +s4.toFixed(2),
    cprWidth: +Math.abs(tc - bc).toFixed(2),
    cprWidthPct: +((Math.abs(tc - bc) / pivot) * 100).toFixed(3),
  };
}

/* ───── Camarilla Calculation ───── */
function calculateCamarilla(high, low, close) {
  const range = high - low;
  const h1 = close + range * (1.1 / 12);
  const h2 = close + range * (1.1 / 6);
  const h3 = close + range * (1.1 / 4);
  const h4 = close + range * (1.1 / 2);
  const h5 = (high / low) * close;
  const h6 = h5 + 1.168 * (h5 - h4);
  const l1 = close - range * (1.1 / 12);
  const l2 = close - range * (1.1 / 6);
  const l3 = close - range * (1.1 / 4);
  const l4 = close - range * (1.1 / 2);
  const l5 = close - (h5 - close);
  const l6 = close - 1.168 * (close - l4);

  return {
    h1: +h1.toFixed(2), h2: +h2.toFixed(2), h3: +h3.toFixed(2),
    h4: +h4.toFixed(2), h5: +h5.toFixed(2), h6: +h6.toFixed(2),
    l1: +l1.toFixed(2), l2: +l2.toFixed(2), l3: +l3.toFixed(2),
    l4: +l4.toFixed(2), l5: +l5.toFixed(2), l6: +l6.toFixed(2),
  };
}

/* ───── Trading Zone Classification ───── */
function classifyZone(currentPrice, cpr, cam) {
  if (!currentPrice) return null;
  const p = currentPrice;
  const zones = [];

  // CPR-based
  if (p > cpr.tc) zones.push({ label: 'Above CPR', sentiment: 'bullish', tip: 'Buyers in control — look for dip-buy setups near TC' });
  else if (p < cpr.bc) zones.push({ label: 'Below CPR', sentiment: 'bearish', tip: 'Sellers in control — look for rally-sell setups near BC' });
  else zones.push({ label: 'Inside CPR', sentiment: 'neutral', tip: 'Consolidation zone — wait for CPR break for direction' });

  // CPR width
  if (cpr.cprWidthPct < 0.1) zones.push({ label: 'Narrow CPR', sentiment: 'caution', tip: '🔥 Very narrow CPR — expect trending/breakout day' });
  else if (cpr.cprWidthPct > 0.5) zones.push({ label: 'Wide CPR', sentiment: 'neutral', tip: 'Wide CPR — expect range-bound / choppy session' });

  // Camarilla zones
  if (p >= cam.h3 && p < cam.h4) zones.push({ label: 'H3-H4 Zone', sentiment: 'bullish', tip: 'Breakout zone — if H3 holds as support, target H4/H5' });
  else if (p >= cam.h4) zones.push({ label: 'Above H4', sentiment: 'bullish', tip: '🚀 Strong breakout — trail with H3 as stop, target H5/H6' });
  else if (p <= cam.l3 && p > cam.l4) zones.push({ label: 'L3-L4 Zone', sentiment: 'bearish', tip: 'Breakdown zone — if L3 holds as resistance, target L4/L5' });
  else if (p <= cam.l4) zones.push({ label: 'Below L4', sentiment: 'bearish', tip: '🔻 Strong breakdown — trail with L3 as stop, target L5/L6' });
  else if (p >= cam.l3 && p <= cam.h3) zones.push({ label: 'L3-H3 Range', sentiment: 'neutral', tip: 'Mean-reversion zone — sell at H3, buy at L3 with tight SL' });

  return zones;
}

/* ───── Strategy suggestions ───── */
function getStrategies(cpr, cam, currentPrice) {
  const strats = [];
  if (!currentPrice) return strats;
  const p = currentPrice;

  // Narrow CPR strategies
  if (cpr.cprWidthPct < 0.15) {
    strats.push({
      name: 'CPR Breakout Play',
      desc: `Narrow CPR (${cpr.cprWidthPct}%) — expect trending day. Buy above ${cpr.tc} with SL ${cpr.bc}, or sell below ${cpr.bc} with SL ${cpr.tc}.`,
      type: 'breakout',
    });
    strats.push({
      name: 'Long Straddle / Strangle',
      desc: `Narrow CPR signals big move ahead. Buy ATM straddle or OTM strangle to profit from directional expansion.`,
      type: 'options',
    });
  }

  // Wide CPR
  if (cpr.cprWidthPct > 0.5) {
    strats.push({
      name: 'Sell Iron Condor',
      desc: `Wide CPR (${cpr.cprWidthPct}%) — range-bound expected. Sell strangles outside CPR range for theta decay.`,
      type: 'options',
    });
  }

  // Camarilla range trade
  if (p >= cam.l3 && p <= cam.h3) {
    strats.push({
      name: 'Camarilla Mean-Reversion',
      desc: `Buy at L3 (${cam.l3}) → target H3 (${cam.h3}), SL below L4 (${cam.l4}). Sell at H3 → target L3, SL above H4 (${cam.h4}).`,
      type: 'intraday',
    });
  }

  // Breakout above H3
  if (p > cam.h3) {
    strats.push({
      name: 'Camarilla Breakout Long',
      desc: `Price above H3 (${cam.h3}) — buy with SL at H3, targets H4 (${cam.h4}) / H5 (${cam.h5}).`,
      type: 'breakout',
    });
  }
  if (p < cam.l3) {
    strats.push({
      name: 'Camarilla Breakdown Short',
      desc: `Price below L3 (${cam.l3}) — sell with SL at L3, targets L4 (${cam.l4}) / L5 (${cam.l5}).`,
      type: 'breakout',
    });
  }

  // CPR as support / resistance
  if (p > cpr.pivot) {
    strats.push({
      name: 'Pivot Support Buy',
      desc: `Pivot (${cpr.pivot}) acts as support — buy pullbacks to pivot with SL below S1 (${cpr.s1}).`,
      type: 'intraday',
    });
  } else {
    strats.push({
      name: 'Pivot Resistance Sell',
      desc: `Pivot (${cpr.pivot}) acts as resistance — sell rallies to pivot with SL above R1 (${cpr.r1}).`,
      type: 'intraday',
    });
  }

  return strats;
}

const INDICES = [
  { symbol: 'NIFTY', name: 'Nifty 50', apiSymbol: '^NSEI', bhavcopyAliases: ['NIFTY', 'NIFTY 50'] },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty', apiSymbol: '^NSEBANK', bhavcopyAliases: ['BANKNIFTY', 'NIFTY BANK', 'NIFTYBANK'] },
  { symbol: 'FINNIFTY', name: 'Fin Nifty', apiSymbol: 'NIFTY_FIN_SERVICE.NS', bhavcopyAliases: ['FINNIFTY', 'NIFTY FIN SERVICE'] },
  { symbol: 'MIDCPNIFTY', name: 'Midcap Nifty', apiSymbol: 'NIFTY_MID_SELECT.NS', bhavcopyAliases: ['MIDCPNIFTY', 'NIFTY MID SELECT', 'NIFTY MIDCAP SELECT'] },
];

export default function PivotLevels() {
  const { darkMode } = useData();

  const [high, setHigh] = useState('');
  const [low, setLow] = useState('');
  const [close, setClose] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchSource, setFetchSource] = useState('');
  const [view, setView] = useState('dashboard');

  /* ───── Fetch from bhavcopy data if available ───── */
  const { bhavcopyData } = useData();

  const autoFillFromBhavcopy = useCallback(() => {
    const latestFut = bhavcopyData.filter((d) => d.type === 'futures').slice(-1)[0];
    if (!latestFut) return false;
    const idx = INDICES.find((i) => i.symbol === selectedIndex);
    if (!idx) return false;
    // Match against all known aliases for this index
    const aliases = idx.bhavcopyAliases.map((a) => a.toUpperCase());
    const niftyRecs = latestFut.records.filter((r) =>
      aliases.includes((r.symbol || '').toUpperCase()),
    );
    if (!niftyRecs.length) return false;
    // Pick near-month expiry (first chronologically)
    niftyRecs.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    const rec = niftyRecs[0];
    setHigh(String(rec.highPrice));
    setLow(String(rec.lowPrice));
    setClose(String(rec.closePrice || rec.settlementPrice));
    setCurrentPrice(String(rec.closePrice || rec.settlementPrice));
    setFetchError('');
    setFetchSource(`Bhavcopy – ${latestFut.date}`);
    return true;
  }, [bhavcopyData, selectedIndex]);

  /* ───── Fetch live data ───── */
  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    setFetchSource('');

    // First try bhavcopy data
    if (autoFillFromBhavcopy()) {
      setLoading(false);
      return;
    }

    // Fallback — try multiple free APIs in order
    const idx = INDICES.find((i) => i.symbol === selectedIndex);
    if (!idx) { setLoading(false); return; }

    const apis = [
      // 1) Yahoo Finance v8 via corsproxy.io
      async () => {
        const url = `https://corsproxy.io/?${encodeURIComponent(
          `https://query1.finance.yahoo.com/v8/finance/chart/${idx.apiSymbol}?interval=1d&range=5d`,
        )}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) throw new Error('No chart data');
        const quotes = result.indicators?.quote?.[0];
        if (!quotes?.high?.length) throw new Error('No quote data');
        // Find last complete trading day (not current partial day)
        // Filter out null values from the end
        let dayIdx = quotes.high.length - 1;
        while (dayIdx > 0 && (quotes.high[dayIdx] == null || quotes.close[dayIdx] == null)) dayIdx--;
        // If market is currently open, use previous day
        const now = new Date();
        const timestamps = result.timestamp;
        if (timestamps && dayIdx > 0) {
          const lastTs = new Date(timestamps[dayIdx] * 1000);
          const hoursSinceCandle = (now - lastTs) / 3600000;
          if (hoursSinceCandle < 8) dayIdx = Math.max(0, dayIdx - 1); // likely current/incomplete day
        }
        return {
          high: quotes.high[dayIdx],
          low: quotes.low[dayIdx],
          close: quotes.close[dayIdx],
          current: result.meta?.regularMarketPrice || quotes.close[quotes.close.length - 1],
          source: 'Yahoo Finance',
        };
      },
      // 2) Yahoo Finance via allorigins
      async () => {
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(
          `https://query1.finance.yahoo.com/v8/finance/chart/${idx.apiSymbol}?interval=1d&range=5d`,
        )}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) throw new Error('No chart data');
        const quotes = result.indicators?.quote?.[0];
        if (!quotes?.high?.length) throw new Error('No quote data');
        let dayIdx = quotes.high.length - 1;
        while (dayIdx > 0 && (quotes.high[dayIdx] == null || quotes.close[dayIdx] == null)) dayIdx--;
        const timestamps = result.timestamp;
        if (timestamps && dayIdx > 0) {
          const lastTs = new Date(timestamps[dayIdx] * 1000);
          if ((new Date() - lastTs) / 3600000 < 8) dayIdx = Math.max(0, dayIdx - 1);
        }
        return {
          high: quotes.high[dayIdx],
          low: quotes.low[dayIdx],
          close: quotes.close[dayIdx],
          current: result.meta?.regularMarketPrice || quotes.close[quotes.close.length - 1],
          source: 'Yahoo Finance (allorigins)',
        };
      },
    ];

    let lastErr = '';
    for (const apiFn of apis) {
      try {
        const d = await apiFn();
        if (d.high && d.low && d.close && d.high >= d.low) {
          setHigh(d.high.toFixed(2));
          setLow(d.low.toFixed(2));
          setClose(d.close.toFixed(2));
          setCurrentPrice(d.current ? d.current.toFixed(2) : d.close.toFixed(2));
          setFetchSource(d.source);
          setLoading(false);
          return;
        }
        lastErr = 'Received invalid price data (null/zero values)';
      } catch (err) {
        lastErr = err.message;
      }
    }

    setFetchError(`Could not fetch live data (${lastErr}). Please enter High / Low / Close manually from NSE website.`);
    setLoading(false);
  }, [selectedIndex, autoFillFromBhavcopy]);

  /* ───── Computed levels ───── */
  const h = Number(high);
  const l = Number(low);
  const c = Number(close);
  const cp = Number(currentPrice);
  const isValid = h > 0 && l > 0 && c > 0 && h >= l;

  const cpr = useMemo(() => (isValid ? calculateCPR(h, l, c) : null), [h, l, c, isValid]);
  const cam = useMemo(() => (isValid ? calculateCamarilla(h, l, c) : null), [h, l, c, isValid]);
  const zones = useMemo(() => (cpr && cam && cp > 0 ? classifyZone(cp, cpr, cam) : null), [cpr, cam, cp]);
  const strategies = useMemo(() => (cpr && cam && cp > 0 ? getStrategies(cpr, cam, cp) : []), [cpr, cam, cp]);

  /* ───── Chart ───── */
  const chartOption = useMemo(() => {
    if (!cpr || !cam) return {};

    const levels = [
      { name: 'R4', value: cpr.r4, color: '#d32f2f' },
      { name: 'R3', value: cpr.r3, color: '#e53935' },
      { name: 'H6', value: cam.h6, color: '#c62828', dash: true },
      { name: 'H5', value: cam.h5, color: '#e53935', dash: true },
      { name: 'R2', value: cpr.r2, color: '#ef5350' },
      { name: 'H4', value: cam.h4, color: '#ef5350', dash: true },
      { name: 'H3', value: cam.h3, color: '#ff7043', dash: true },
      { name: 'R1', value: cpr.r1, color: '#ff8a65' },
      { name: 'H2', value: cam.h2, color: '#ffab91', dash: true },
      { name: 'H1', value: cam.h1, color: '#ffccbc', dash: true },
      { name: 'TC', value: cpr.tc, color: '#42a5f5', width: 3 },
      { name: 'Pivot', value: cpr.pivot, color: '#1e88e5', width: 3 },
      { name: 'BC', value: cpr.bc, color: '#42a5f5', width: 3 },
      { name: 'L1', value: cam.l1, color: '#c8e6c9', dash: true },
      { name: 'L2', value: cam.l2, color: '#a5d6a7', dash: true },
      { name: 'S1', value: cpr.s1, color: '#66bb6a' },
      { name: 'L3', value: cam.l3, color: '#4caf50', dash: true },
      { name: 'L4', value: cam.l4, color: '#388e3c', dash: true },
      { name: 'S2', value: cpr.s2, color: '#2e7d32' },
      { name: 'L5', value: cam.l5, color: '#1b5e20', dash: true },
      { name: 'S3', value: cpr.s3, color: '#1b5e20' },
      { name: 'L6', value: cam.l6, color: '#004d40', dash: true },
      { name: 'S4', value: cpr.s4, color: '#004d40' },
    ].sort((a, b) => b.value - a.value);

    const markLines = levels.map((lv) => ({
      yAxis: lv.value,
      lineStyle: { color: lv.color, width: lv.width || 1.5, type: lv.dash ? 'dashed' : 'solid' },
      label: { formatter: `${lv.name}: ${lv.value}`, color: lv.color, fontSize: 11 },
    }));

    // Add current price line
    if (cp > 0) {
      markLines.push({
        yAxis: cp,
        lineStyle: { color: '#fdd835', width: 2.5, type: 'solid' },
        label: { formatter: `CMP: ${cp}`, color: '#fdd835', fontWeight: 'bold', fontSize: 13 },
      });
    }

    const allVals = levels.map((l) => l.value);
    if (cp > 0) allVals.push(cp);

    return {
      tooltip: {},
      grid: { left: 80, right: 140, top: 20, bottom: 20 },
      xAxis: { type: 'category', data: ['Levels'], show: false },
      yAxis: {
        type: 'value',
        scale: true,
        min: Math.min(...allVals) - 50,
        max: Math.max(...allVals) + 50,
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line',
        data: [],
        markLine: { symbol: 'none', data: markLines },
      }],
    };
  }, [cpr, cam, cp, darkMode]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <LinearScale sx={{ color: 'primary.main', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Pivot & Camarilla Levels
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="dashboard">Dashboard</ToggleButton>
          <ToggleButton value="chart">Chart</ToggleButton>
          <ToggleButton value="table">Table</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Input section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm="auto">
              <ToggleButtonGroup
                size="small"
                exclusive
                value={selectedIndex}
                onChange={(_, v) => v && setSelectedIndex(v)}
              >
                {INDICES.map((idx) => (
                  <ToggleButton key={idx.symbol} value={idx.symbol}>{idx.name}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField label="High" size="small" fullWidth type="number"
                value={high} onChange={(e) => setHigh(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField label="Low" size="small" fullWidth type="number"
                value={low} onChange={(e) => setLow(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField label="Close" size="small" fullWidth type="number"
                value={close} onChange={(e) => setClose(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField label="Current Price" size="small" fullWidth type="number"
                value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm="auto">
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
                onClick={fetchLiveData}
                disabled={loading}
                size="small"
              >
                {loading ? 'Fetching...' : 'Fetch Data'}
              </Button>
            </Grid>
          </Grid>
          {fetchError && <Alert severity="warning" sx={{ mt: 1.5 }}>{fetchError}</Alert>}
          {fetchSource && !fetchError && (
            <Alert severity="success" sx={{ mt: 1.5 }}>
              ✅ Data loaded from <strong>{fetchSource}</strong> — H: {high}, L: {low}, C: {close}
            </Alert>
          )}
          {!isValid && (high || low || close) && (
            <Alert severity="error" sx={{ mt: 1 }}>Enter valid High, Low, Close values (High ≥ Low, all &gt; 0)</Alert>
          )}
        </CardContent>
      </Card>

      {!isValid && (
        <Alert severity="info">
          Enter previous day's <strong>High, Low, Close</strong> or click <strong>Fetch Data</strong> to auto-fill
          from uploaded bhavcopy / live API. Supports Nifty 50, Bank Nifty, Fin Nifty, Midcap Nifty.
        </Alert>
      )}

      {/* ═══ DASHBOARD VIEW ═══ */}
      {isValid && view === 'dashboard' && (
        <Grid container spacing={3}>
          {/* Zone Classification */}
          {zones && (
            <Grid item xs={12}>
              <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Calculate sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {INDICES.find((i) => i.symbol === selectedIndex)?.name} — Zone Analysis
                    </Typography>
                    {cp > 0 && (
                      <Chip label={`CMP: ₹${cp}`} color="primary" sx={{ fontWeight: 700, fontSize: 14 }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {zones.map((z, i) => (
                      <Tooltip key={i} title={z.tip}>
                        <Chip
                          icon={z.sentiment === 'bullish' ? <TrendingUp /> : z.sentiment === 'bearish' ? <TrendingDown /> : <Remove />}
                          label={z.label}
                          color={z.sentiment === 'bullish' ? 'success' : z.sentiment === 'bearish' ? 'error' : z.sentiment === 'caution' ? 'warning' : 'default'}
                          sx={{ fontWeight: 600 }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  {zones.map((z, i) => (
                    <Alert
                      key={i}
                      severity={z.sentiment === 'bullish' ? 'success' : z.sentiment === 'bearish' ? 'error' : 'warning'}
                      sx={{ mb: 0.8 }}
                      icon={false}
                    >
                      <Typography variant="body2">
                        {z.sentiment === 'bullish' ? '📈' : z.sentiment === 'bearish' ? '📉' : '⚠️'} {z.tip}
                      </Typography>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* CPR Levels Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>📊 Central Pivot Range (CPR)</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  CPR Width: {cpr.cprWidth} pts ({cpr.cprWidthPct}%) — {cpr.cprWidthPct < 0.15 ? '🔥 Narrow → Trending Day' : cpr.cprWidthPct > 0.5 ? '📦 Wide → Range Day' : 'Normal'}
                </Typography>
                <Grid container spacing={1}>
                  {[
                    { label: 'R4', value: cpr.r4, color: '#d32f2f' },
                    { label: 'R3', value: cpr.r3, color: '#e53935' },
                    { label: 'R2', value: cpr.r2, color: '#ef5350' },
                    { label: 'R1', value: cpr.r1, color: '#ff8a65' },
                    { label: 'TC', value: cpr.tc, color: '#42a5f5', bold: true },
                    { label: 'Pivot', value: cpr.pivot, color: '#1e88e5', bold: true },
                    { label: 'BC', value: cpr.bc, color: '#42a5f5', bold: true },
                    { label: 'S1', value: cpr.s1, color: '#66bb6a' },
                    { label: 'S2', value: cpr.s2, color: '#2e7d32' },
                    { label: 'S3', value: cpr.s3, color: '#1b5e20' },
                    { label: 'S4', value: cpr.s4, color: '#004d40' },
                  ].map((lv) => (
                    <Grid item xs={4} key={lv.label}>
                      <Box sx={{
                        p: 1, borderRadius: 1, textAlign: 'center',
                        bgcolor: lv.bold ? 'primary.main' : 'action.hover',
                        color: lv.bold ? '#fff' : 'inherit',
                        border: cp > 0 && Math.abs(cp - lv.value) < cpr.cprWidth * 0.3 ? '2px solid #fdd835' : 'none',
                      }}>
                        <Typography variant="caption" sx={{ color: lv.bold ? '#fff' : lv.color, fontWeight: 600 }}>
                          {lv.label}
                        </Typography>
                        <Typography variant="body1" fontWeight={700}>
                          {lv.value.toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Camarilla Levels Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🎯 Camarilla Levels</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  H3-L3: Mean-reversion zone | H4/L4: Breakout/Breakdown
                </Typography>
                <Grid container spacing={1}>
                  {[
                    { label: 'H6', value: cam.h6, color: '#c62828' },
                    { label: 'H5', value: cam.h5, color: '#d32f2f' },
                    { label: 'H4', value: cam.h4, color: '#e53935', bold: true },
                    { label: 'H3', value: cam.h3, color: '#ef5350', bold: true },
                    { label: 'H2', value: cam.h2, color: '#ff7043' },
                    { label: 'H1', value: cam.h1, color: '#ff8a65' },
                    { label: 'L1', value: cam.l1, color: '#66bb6a' },
                    { label: 'L2', value: cam.l2, color: '#4caf50' },
                    { label: 'L3', value: cam.l3, color: '#388e3c', bold: true },
                    { label: 'L4', value: cam.l4, color: '#2e7d32', bold: true },
                    { label: 'L5', value: cam.l5, color: '#1b5e20' },
                    { label: 'L6', value: cam.l6, color: '#004d40' },
                  ].map((lv) => (
                    <Grid item xs={4} key={lv.label}>
                      <Box sx={{
                        p: 1, borderRadius: 1, textAlign: 'center',
                        bgcolor: lv.bold ? 'action.selected' : 'action.hover',
                        border: cp > 0 && Math.abs(cp - lv.value) < Math.abs(cam.h3 - cam.l3) * 0.1 ? '2px solid #fdd835' : 'none',
                      }}>
                        <Typography variant="caption" sx={{ color: lv.color, fontWeight: 600 }}>
                          {lv.label}
                        </Typography>
                        <Typography variant="body1" fontWeight={700}>
                          {lv.value.toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Trading Strategies */}
          {strategies.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>💡 Trading Strategies</Typography>
                  {strategies.map((s, i) => (
                    <Card key={i} variant="outlined" sx={{ mb: 1.5, bgcolor: 'background.default' }}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                            {s.name}
                          </Typography>
                          <Chip
                            label={s.type}
                            size="small"
                            color={s.type === 'breakout' ? 'error' : s.type === 'options' ? 'warning' : 'primary'}
                            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">{s.desc}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* ═══ CHART VIEW ═══ */}
      {isValid && view === 'chart' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {INDICES.find((i) => i.symbol === selectedIndex)?.name} — All Levels
            </Typography>
            <ReactECharts option={chartOption} style={{ height: 600 }} />
          </CardContent>
        </Card>
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {isValid && view === 'table' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>CPR / Standard Pivot Levels</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell align="right">Distance from CMP</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        { label: 'R4', value: cpr.r4 },
                        { label: 'R3', value: cpr.r3 },
                        { label: 'R2', value: cpr.r2 },
                        { label: 'R1', value: cpr.r1 },
                        { label: 'TC (Top Central)', value: cpr.tc, highlight: true },
                        { label: 'Pivot', value: cpr.pivot, highlight: true },
                        { label: 'BC (Bottom Central)', value: cpr.bc, highlight: true },
                        { label: 'S1', value: cpr.s1 },
                        { label: 'S2', value: cpr.s2 },
                        { label: 'S3', value: cpr.s3 },
                        { label: 'S4', value: cpr.s4 },
                      ].map((lv) => {
                        const dist = cp > 0 ? ((lv.value - cp) / cp * 100).toFixed(2) : '—';
                        return (
                          <TableRow key={lv.label} sx={{ bgcolor: lv.highlight ? 'action.selected' : 'inherit' }}>
                            <TableCell sx={{ fontWeight: lv.highlight ? 700 : 400 }}>{lv.label}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {lv.value.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell align="right" sx={{ color: Number(dist) > 0 ? 'error.main' : 'success.main' }}>
                              {dist !== '—' ? `${Number(dist) > 0 ? '+' : ''}${dist}%` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ mt: 1.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption">
                    <strong>CPR Width:</strong> {cpr.cprWidth} pts ({cpr.cprWidthPct}%) —{' '}
                    {cpr.cprWidthPct < 0.15 ? '🔥 Narrow (Trending Day)' : cpr.cprWidthPct > 0.5 ? '📦 Wide (Range Day)' : '⚖️ Normal'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Camarilla Levels</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell align="right">Distance from CMP</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        { label: 'H6', value: cam.h6, action: 'Extreme resistance' },
                        { label: 'H5', value: cam.h5, action: 'Breakout target 2' },
                        { label: 'H4', value: cam.h4, action: 'Breakout confirmation', highlight: true },
                        { label: 'H3', value: cam.h3, action: 'Sell / Short trigger', highlight: true },
                        { label: 'H2', value: cam.h2, action: 'Minor resistance' },
                        { label: 'H1', value: cam.h1, action: 'Minor resistance' },
                        { label: 'L1', value: cam.l1, action: 'Minor support' },
                        { label: 'L2', value: cam.l2, action: 'Minor support' },
                        { label: 'L3', value: cam.l3, action: 'Buy / Long trigger', highlight: true },
                        { label: 'L4', value: cam.l4, action: 'Breakdown confirmation', highlight: true },
                        { label: 'L5', value: cam.l5, action: 'Breakdown target 2' },
                        { label: 'L6', value: cam.l6, action: 'Extreme support' },
                      ].map((lv) => {
                        const dist = cp > 0 ? ((lv.value - cp) / cp * 100).toFixed(2) : '—';
                        return (
                          <TableRow key={lv.label} sx={{ bgcolor: lv.highlight ? 'action.selected' : 'inherit' }}>
                            <TableCell sx={{ fontWeight: lv.highlight ? 700 : 400 }}>{lv.label}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {lv.value.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell align="right" sx={{ color: Number(dist) > 0 ? 'error.main' : 'success.main' }}>
                              {dist !== '—' ? `${Number(dist) > 0 ? '+' : ''}${dist}%` : '—'}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{lv.action}</Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
