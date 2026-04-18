import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, TextField, Button, Chip,
  IconButton, Divider, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, Tooltip, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  Add, Delete, Edit, Public, TrendingUp, TrendingDown, Remove,
  Event, Warning, Shield, Calculate, Checklist, PlaylistAddCheck,
  AttachMoney, Speed, LocalFireDepartment, WarningAmber,
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';
import { formatNum } from '../utils/insights';

/* ─── Default empty entry for today ─── */
function emptyEntry(date) {
  return {
    date,
    // US Futures
    spFutures: '',
    nasdaqFutures: '',
    spFuturesChange: '',
    nasdaqFuturesChange: '',
    // Dollar / Yields / Crude
    dxy: '',
    dxyChange: '',
    us10y: '',
    us10yChange: '',
    crudeOil: '',
    crudeOilChange: '',
    // India VIX
    indiaVix: '',
    indiaVixChange: '',
    // Special Events
    isWeeklyExpiry: false,
    isMonthlyExpiry: false,
    specialEvents: '',
    // Notes
    notes: '',
  };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ─── Signal chip for a change value ─── */
function ChangeChip({ value, inverted = false }) {
  if (value === '' || value == null) return <Chip label="—" size="small" variant="outlined" />;
  const num = Number(value);
  if (isNaN(num)) return <Chip label={value} size="small" variant="outlined" />;
  const bullish = inverted ? num < 0 : num > 0;
  const bearish = inverted ? num > 0 : num < 0;
  return (
    <Chip
      icon={num > 0 ? <TrendingUp /> : num < 0 ? <TrendingDown /> : <Remove />}
      label={`${num > 0 ? '+' : ''}${num}${String(value).includes('%') ? '' : '%'}`}
      size="small"
      color={bullish ? 'success' : bearish ? 'error' : 'default'}
      sx={{ fontWeight: 700 }}
    />
  );
}

/* ─── Impact descriptor ─── */
function ImpactTag({ label, value, bullishIf, unit = '' }) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  if (isNaN(num)) return null;
  const isBullish = bullishIf === 'positive' ? num > 0 : bullishIf === 'negative' ? num < 0 : null;
  return (
    <Typography variant="caption" sx={{ color: isBullish === true ? 'success.main' : isBullish === false ? 'error.main' : 'text.secondary' }}>
      {label}: {isBullish ? '📈 Bullish' : isBullish === false ? '📉 Bearish' : '➖ Neutral'} for Nifty
    </Typography>
  );
}

/* ─── Position Sizer Widget ─── */
function PositionSizer({ maxRiskPct }) {
  const [capital, setCapital] = useState('');
  const [sl, setSl] = useState('');
  const [entry, setEntry] = useState('');
  const riskAmt = capital && maxRiskPct ? (Number(capital) * maxRiskPct / 100) : 0;
  const slPoints = entry && sl ? Math.abs(Number(entry) - Number(sl)) : 0;
  const lotSize = 25; // Nifty lot
  const maxLots = slPoints > 0 ? Math.floor(riskAmt / (slPoints * lotSize)) : 0;
  return (
    <Box>
      <Grid container spacing={1.5}>
        <Grid item xs={4}>
          <TextField label="Capital (₹)" fullWidth size="small" type="number"
            value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="500000" />
        </Grid>
        <Grid item xs={4}>
          <TextField label="Entry" fullWidth size="small" type="number"
            value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="24500" />
        </Grid>
        <Grid item xs={4}>
          <TextField label="Stop Loss" fullWidth size="small" type="number"
            value={sl} onChange={(e) => setSl(e.target.value)} placeholder="24400" />
        </Grid>
      </Grid>
      {capital && entry && sl && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="body2">
            Risk per trade ({maxRiskPct}%): <strong>₹{riskAmt.toLocaleString('en-IN')}</strong>
          </Typography>
          <Typography variant="body2">
            SL distance: <strong>{slPoints} pts</strong> (₹{(slPoints * lotSize).toLocaleString('en-IN')}/lot)
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, color: maxLots > 0 ? 'success.main' : 'error.main' }}>
            Max Lots: {maxLots} ({maxLots * lotSize} qty)
          </Typography>
          {maxLots === 0 && (
            <Typography variant="caption" color="error">SL too wide for this risk budget — widen risk or tighten SL</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/* ─── Day Type Classification ─── */
function DayTypeCard({ dailySignal, latest }) {
  if (!dailySignal || !latest) return null;
  const vix = Number(latest.indiaVix) || 14;
  const isExpiry = latest.isWeeklyExpiry || latest.isMonthlyExpiry;
  const score = dailySignal.score;

  let dayType, dayDesc, dayColor, tradingTips;
  if (vix > 20 && Math.abs(score) >= 2) {
    dayType = '🌪️ Trending / Volatile';
    dayDesc = 'High VIX + strong directional cues → expect a trending day with wide range';
    dayColor = 'error.main';
    tradingTips = [
      'Trade with the trend — avoid counter-trend entries',
      'Use trailing stops instead of fixed targets',
      'Expect 1.5-2x normal daily range',
    ];
  } else if (vix > 18 && isExpiry) {
    dayType = '⚡ Gamma Squeeze Risk';
    dayDesc = 'High VIX on expiry → pin risk near max pain, sharp moves possible near close';
    dayColor = 'warning.main';
    tradingTips = [
      'Avoid selling options near ATM strikes',
      'Watch max pain level for magnetic pull',
      'Reduce position size by 50%',
    ];
  } else if (vix < 13 && Math.abs(score) <= 1) {
    dayType = '😴 Range-Bound / Choppy';
    dayDesc = 'Low VIX + no strong cues → expect narrow range, mean-reversion works';
    dayColor = 'success.main';
    tradingTips = [
      'Sell strangles / iron condors — collect theta',
      'Fade extremes — buy support, sell resistance',
      'Tight targets, quick profits',
    ];
  } else if (isExpiry) {
    dayType = '⚡ Expiry Day';
    dayDesc = 'Gamma effects dominate — price gravitates to max pain, sharp moves in last hour';
    dayColor = 'warning.main';
    tradingTips = [
      'Be careful with naked option sells',
      'Watch for pin near max pain / round strikes',
      'Reduce size in afternoon session',
    ];
  } else if (Math.abs(score) >= 2) {
    dayType = score > 0 ? '🟢 Bullish Trend Day' : '🔴 Bearish Trend Day';
    dayDesc = score > 0 ? 'Strong bullish setup — buy dips strategy favored' : 'Strong bearish setup — sell rallies strategy favored';
    dayColor = score > 0 ? 'success.main' : 'error.main';
    tradingTips = score > 0
      ? ['Buy call spreads on dips', 'Trail longs with time-based stops', 'Avoid shorting']
      : ['Buy put spreads on rallies', 'Trail shorts aggressively', 'Avoid bottom fishing'];
  } else {
    dayType = '⚖️ Normal / Balanced';
    dayDesc = 'Mixed signals — no strong bias, play both sides with discipline';
    dayColor = 'text.secondary';
    tradingTips = [
      'Wait for first 30 min to establish range',
      'Trade breakouts of opening range',
      'Normal position sizing',
    ];
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ color: dayColor, fontWeight: 700, mb: 1 }}>{dayType}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{dayDesc}</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="subtitle2" gutterBottom>💡 Trading Tips:</Typography>
      {tradingTips.map((tip, i) => (
        <Typography key={i} variant="body2" sx={{ pl: 1, mb: 0.5 }}>• {tip}</Typography>
      ))}
    </Box>
  );
}

export default function GlobalMarketContext() {
  const { marketContextData, addMarketContext, removeMarketContext, darkMode } = useData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [view, setView] = useState('cards');

  const latest = marketContextData[marketContextData.length - 1] || null;

  /* ───── Open add/edit dialog ───── */
  const handleAdd = () => {
    setEditEntry(emptyEntry(todayISO()));
    setDialogOpen(true);
  };
  const handleEdit = (entry) => {
    setEditEntry({ ...entry });
    setDialogOpen(true);
  };
  const handleSave = () => {
    if (editEntry?.date) {
      addMarketContext(editEntry);
    }
    setDialogOpen(false);
    setEditEntry(null);
  };
  const handleDelete = (date) => {
    removeMarketContext(date);
    setDeleteConfirm(null);
  };

  const updateField = (field, value) => {
    setEditEntry((prev) => ({ ...prev, [field]: value }));
  };

  /* ───── Charts ───── */
  const chartData = useMemo(() => {
    if (marketContextData.length < 2) return null;
    const dates = marketContextData.map((d) => formatDate(d.date));
    return { dates, entries: marketContextData };
  }, [marketContextData]);

  const dxyChart = useMemo(() => {
    if (!chartData) return {};
    const vals = chartData.entries.map((e) => e.dxy || null).filter((v) => v !== null && v !== '');
    if (vals.length < 2) return {};
    return {
      tooltip: { trigger: 'axis' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 30 },
      xAxis: {
        type: 'category',
        data: chartData.entries.filter((e) => e.dxy !== '' && e.dxy != null).map((e) => formatDate(e.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line', smooth: true,
        data: chartData.entries.filter((e) => e.dxy !== '' && e.dxy != null).map((e) => Number(e.dxy)),
        lineStyle: { width: 2.5, color: '#ff9800' },
        areaStyle: { opacity: 0.1, color: '#ff9800' },
        itemStyle: { color: '#ff9800' },
        symbol: 'circle', symbolSize: 6,
      }],
    };
  }, [chartData, darkMode]);

  const yieldChart = useMemo(() => {
    if (!chartData) return {};
    const valid = chartData.entries.filter((e) => e.us10y !== '' && e.us10y != null);
    if (valid.length < 2) return {};
    return {
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>US 10Y: ${p[0].value}%` },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 30 },
      xAxis: {
        type: 'category', data: valid.map((e) => formatDate(e.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => `${v}%` },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line', smooth: true,
        data: valid.map((e) => Number(e.us10y)),
        lineStyle: { width: 2.5, color: '#ef5350' },
        areaStyle: { opacity: 0.1, color: '#ef5350' },
        itemStyle: { color: '#ef5350' },
        symbol: 'circle', symbolSize: 6,
      }],
    };
  }, [chartData, darkMode]);

  const crudeChart = useMemo(() => {
    if (!chartData) return {};
    const valid = chartData.entries.filter((e) => e.crudeOil !== '' && e.crudeOil != null);
    if (valid.length < 2) return {};
    return {
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>Crude: $${p[0].value}` },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 30 },
      xAxis: {
        type: 'category', data: valid.map((e) => formatDate(e.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => `$${v}` },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line', smooth: true,
        data: valid.map((e) => Number(e.crudeOil)),
        lineStyle: { width: 2.5, color: '#8d6e63' },
        areaStyle: { opacity: 0.1, color: '#8d6e63' },
        itemStyle: { color: '#8d6e63' },
        symbol: 'circle', symbolSize: 6,
      }],
    };
  }, [chartData, darkMode]);

  const vixChart = useMemo(() => {
    if (!chartData) return {};
    const valid = chartData.entries.filter((e) => e.indiaVix !== '' && e.indiaVix != null);
    if (valid.length < 2) return {};
    return {
      tooltip: { trigger: 'axis' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 30 },
      xAxis: {
        type: 'category', data: valid.map((e) => formatDate(e.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line', smooth: true,
        data: valid.map((e) => Number(e.indiaVix)),
        lineStyle: { width: 2.5, color: '#ab47bc' },
        areaStyle: { opacity: 0.15, color: '#ab47bc' },
        itemStyle: {
          color: (p) => Number(p.value) > 18 ? '#f44336' : Number(p.value) < 13 ? '#4caf50' : '#ff9800',
        },
        symbol: 'circle', symbolSize: 7,
        markLine: {
          symbol: 'none',
          data: [
            { yAxis: 13, lineStyle: { color: '#4caf50', type: 'dashed' }, label: { formatter: 'Low Fear', color: '#4caf50' } },
            { yAxis: 18, lineStyle: { color: '#f44336', type: 'dashed' }, label: { formatter: 'High Fear', color: '#f44336' } },
          ],
        },
      }],
    };
  }, [chartData, darkMode]);

  /* ───── Composite daily signal for latest ───── */
  const dailySignal = useMemo(() => {
    if (!latest) return null;
    let score = 0;
    const signals = [];

    // US Futures
    const spChg = Number(latest.spFuturesChange);
    if (!isNaN(spChg) && spChg !== 0) {
      if (spChg > 0.3) { score += 1; signals.push({ text: `S&P futures up ${spChg}% — positive global cue`, sentiment: 'bullish' }); }
      else if (spChg < -0.3) { score -= 1; signals.push({ text: `S&P futures down ${spChg}% — negative global cue`, sentiment: 'bearish' }); }
    }
    const nqChg = Number(latest.nasdaqFuturesChange);
    if (!isNaN(nqChg) && nqChg !== 0) {
      if (nqChg > 0.5) { score += 1; signals.push({ text: `Nasdaq futures up ${nqChg}% — risk-on sentiment`, sentiment: 'bullish' }); }
      else if (nqChg < -0.5) { score -= 1; signals.push({ text: `Nasdaq futures down ${nqChg}% — risk-off sentiment`, sentiment: 'bearish' }); }
    }

    // DXY — strong dollar = bearish for India
    const dxyChg = Number(latest.dxyChange);
    if (!isNaN(dxyChg) && dxyChg !== 0) {
      if (dxyChg > 0.3) { score -= 1; signals.push({ text: `DXY rising ${dxyChg}% — FII outflow pressure`, sentiment: 'bearish' }); }
      else if (dxyChg < -0.3) { score += 1; signals.push({ text: `DXY falling ${dxyChg}% — FII inflow support`, sentiment: 'bullish' }); }
    }

    // US 10Y — rising yields = pressure
    const yieldChg = Number(latest.us10yChange);
    if (!isNaN(yieldChg) && yieldChg !== 0) {
      if (yieldChg > 0) { score -= 1; signals.push({ text: `US 10Y yield rising — emerging market pressure`, sentiment: 'bearish' }); }
      else { score += 1; signals.push({ text: `US 10Y yield falling — supportive for emerging markets`, sentiment: 'bullish' }); }
    }

    // Crude — high crude = bearish for India
    const crudeChg = Number(latest.crudeOilChange);
    if (!isNaN(crudeChg) && crudeChg !== 0) {
      if (crudeChg > 1) { score -= 1; signals.push({ text: `Crude up ${crudeChg}% — INR negative, import pressure`, sentiment: 'bearish' }); }
      else if (crudeChg < -1) { score += 1; signals.push({ text: `Crude down ${crudeChg}% — INR positive`, sentiment: 'bullish' }); }
    }

    // India VIX
    const vixVal = Number(latest.indiaVix);
    const vixChg = Number(latest.indiaVixChange);
    if (!isNaN(vixVal)) {
      if (vixVal > 18) { score -= 1; signals.push({ text: `India VIX at ${vixVal} — high fear, expect volatile swings`, sentiment: 'bearish' }); }
      else if (vixVal < 13) { score += 1; signals.push({ text: `India VIX at ${vixVal} — low fear, calm market`, sentiment: 'bullish' }); }
    }
    if (!isNaN(vixChg) && Math.abs(vixChg) > 3) {
      if (vixChg > 0) { signals.push({ text: `VIX spiked ${vixChg}% — fear increasing`, sentiment: 'bearish' }); }
      else { signals.push({ text: `VIX dropped ${vixChg}% — fear subsiding`, sentiment: 'bullish' }); }
    }

    // Special days
    if (latest.isWeeklyExpiry) { signals.push({ text: '⚡ Weekly expiry — gamma effects amplified', sentiment: 'caution' }); }
    if (latest.isMonthlyExpiry) { signals.push({ text: '⚡⚡ Monthly expiry — heavy gamma, rollover effects', sentiment: 'caution' }); }
    if (latest.specialEvents) { signals.push({ text: `📅 ${latest.specialEvents}`, sentiment: 'caution' }); }

    const label = score >= 2 ? 'Bullish Global Setup' : score <= -2 ? 'Bearish Global Setup'
      : score > 0 ? 'Mildly Bullish' : score < 0 ? 'Mildly Bearish' : 'Neutral';
    const color = score >= 2 ? 'success' : score <= -2 ? 'error' : 'warning';

    return { score, signals, label, color };
  }, [latest]);

  /* ───── Hedge Recommendation Engine ───── */
  const hedgeAdvice = useMemo(() => {
    if (!dailySignal || !latest) return null;
    const { score } = dailySignal;
    const vix = Number(latest.indiaVix) || 14;
    const isExpiry = latest.isWeeklyExpiry || latest.isMonthlyExpiry;
    const isMonthly = latest.isMonthlyExpiry;

    const strategies = [];
    const riskLevel = Math.abs(score) >= 2 ? 'HIGH' : Math.abs(score) === 1 ? 'MODERATE' : 'LOW';
    const riskColor = riskLevel === 'HIGH' ? 'error' : riskLevel === 'MODERATE' ? 'warning' : 'success';

    // Directional hedges
    if (score <= -2) {
      strategies.push({
        name: 'Buy Nifty Put (OTM 1-2%)',
        type: 'protection',
        rationale: 'Strong bearish global cues — protect long equity exposure',
        urgency: 'high',
        cost: vix > 16 ? 'Premium elevated due to high VIX — consider put spread to reduce cost' : 'Premium reasonable',
      });
      strategies.push({
        name: 'Bear Put Spread',
        type: 'directional',
        rationale: 'Defined risk bearish play — buy ATM put, sell OTM put 2% below',
        urgency: 'medium',
        cost: 'Net debit = ATM premium − OTM premium received',
      });
      if (vix > 18) {
        strategies.push({
          name: 'Short Straddle with Put Hedge',
          type: 'income',
          rationale: 'VIX is elevated — sell premium but protect downside with further OTM put',
          urgency: 'medium',
          cost: 'Net credit strategy but requires margin',
        });
      }
    } else if (score >= 2) {
      strategies.push({
        name: 'Sell OTM Puts (Cash-Secured)',
        type: 'income',
        rationale: 'Bullish cues — collect premium, willing to buy dip if assigned',
        urgency: 'medium',
        cost: 'Net credit — keep cash aside for potential assignment',
      });
      strategies.push({
        name: 'Bull Call Spread',
        type: 'directional',
        rationale: 'Defined risk bullish play — buy ATM call, sell OTM call 2% above',
        urgency: 'medium',
        cost: 'Net debit spread',
      });
    }

    // VIX-based strategies
    if (vix < 12) {
      strategies.push({
        name: 'Buy Straddle / Long Volatility',
        type: 'volatility',
        rationale: `VIX at ${vix} is historically low — mean reversion likely, buy cheap optionality`,
        urgency: 'low',
        cost: 'Cheap premiums — good time to buy protection',
      });
    } else if (vix > 20) {
      strategies.push({
        name: 'Sell Iron Condor',
        type: 'income',
        rationale: `VIX at ${vix} — premiums are rich, sell wings for income`,
        urgency: 'medium',
        cost: 'Net credit but high margin requirement',
      });
      strategies.push({
        name: 'Ratio Put Backspread',
        type: 'protection',
        rationale: 'Sell 1 ATM put, buy 2 OTM puts — free/cheap tail protection',
        urgency: 'high',
        cost: 'Near zero cost or small credit',
      });
    }

    // Expiry-specific
    if (isExpiry) {
      strategies.push({
        name: isMonthly ? 'Reduce Gamma Exposure' : 'Tighten Stop Losses',
        type: 'risk-mgmt',
        rationale: isMonthly
          ? 'Monthly expiry — gamma amplification, pin risk, rollover volatility'
          : 'Weekly expiry — gamma effects can cause sharp moves near strikes',
        urgency: 'high',
        cost: 'No cost — position management',
      });
      if (score < 0) {
        strategies.push({
          name: 'Calendar Spread (Sell Weekly, Buy Monthly)',
          type: 'time-decay',
          rationale: 'Capitalize on faster theta decay of weekly options',
          urgency: 'medium',
          cost: 'Net debit — weekly premium offsets partial cost',
        });
      }
    }

    // Crude / DXY specific hedges
    const crudeChg = Number(latest.crudeOilChange);
    if (!isNaN(crudeChg) && crudeChg > 2) {
      strategies.push({
        name: 'Hedge: Short OMC stocks / Long IT',
        type: 'sector-hedge',
        rationale: `Crude spiking ${crudeChg}% — Oil Marketing Companies pressured, IT benefits from weak INR`,
        urgency: 'medium',
        cost: 'Pair trade — market-neutral approach',
      });
    }
    const dxyChg = Number(latest.dxyChange);
    if (!isNaN(dxyChg) && dxyChg > 0.5) {
      strategies.push({
        name: 'Hedge: Long IT / Short Importers',
        type: 'sector-hedge',
        rationale: `DXY rising ${dxyChg}% — IT exporters benefit, importers (pharma API) pressured`,
        urgency: 'low',
        cost: 'Pair trade — sector rotation',
      });
    }

    // Position sizing guidance
    const maxRiskPct = riskLevel === 'HIGH' ? 1 : riskLevel === 'MODERATE' ? 2 : 3;
    const suggestedLots = riskLevel === 'HIGH' ? '50%' : riskLevel === 'MODERATE' ? '75%' : '100%';

    // Pre-market checklist
    const checklist = [
      { item: 'Check SGX Nifty / GIFT Nifty for gap indication', done: false },
      { item: 'Review overnight US close + Asia open', done: false },
      { item: 'Note any F&O ban list additions/deletions', done: false },
      { item: 'Check India VIX pre-open indication', done: false },
      { item: `Max risk per trade: ${maxRiskPct}% of capital`, done: false },
      { item: `Position sizing: ${suggestedLots} of normal size`, done: false },
      ...(isExpiry ? [
        { item: '⚡ Expiry day — avoid naked option selling near ATM', done: false },
        { item: '⚡ Check max pain level for pin reference', done: false },
      ] : []),
      ...(score <= -2 ? [
        { item: '🔴 Bearish setup — avoid fresh long builds at open', done: false },
        { item: '🔴 Keep hedge active — don\'t remove puts early', done: false },
      ] : []),
      ...(score >= 2 ? [
        { item: '🟢 Bullish setup — buy dips, avoid shorting rallies', done: false },
      ] : []),
      ...(vix > 18 ? [
        { item: '🔥 High VIX — widen stop losses, reduce position size', done: false },
      ] : []),
    ];

    return { strategies, riskLevel, riskColor, maxRiskPct, suggestedLots, checklist };
  }, [dailySignal, latest]);

  /* ───── Checklist state ───── */
  const [checklistState, setChecklistState] = useState({});
  const toggleCheck = (idx) => setChecklistState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const checkedCount = hedgeAdvice ? hedgeAdvice.checklist.filter((_, i) => checklistState[i]).length : 0;
  const totalChecks = hedgeAdvice ? hedgeAdvice.checklist.length : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Public sx={{ color: 'primary.main', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Global Market Context
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="cards">Today</ToggleButton>
          <ToggleButton value="hedge">Hedge Desk</ToggleButton>
          <ToggleButton value="history">History</ToggleButton>
          <ToggleButton value="charts">Charts</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<Add />} onClick={handleAdd} size="small">
          Log Today
        </Button>
      </Box>

      {/* ═══ TODAY'S VIEW ═══ */}
      {view === 'cards' && (
        <>
          {!latest ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              No market context logged yet. Click <strong>"Log Today"</strong> to record daily global signals
              (US futures, DXY, yields, crude, VIX, events).
            </Alert>
          ) : (
            <>
              {/* Daily Signal Summary */}
              {dailySignal && (
                <Card sx={{ mb: 3, border: '2px solid', borderColor: `${dailySignal.color}.main` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Public sx={{ fontSize: 28, color: `${dailySignal.color}.main` }} />
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Global Signal — {formatDate(latest.date)}
                      </Typography>
                      <Chip label={dailySignal.label} color={dailySignal.color} sx={{ fontWeight: 700, fontSize: 14 }} />
                      <Tooltip title="Edit this entry">
                        <IconButton size="small" onClick={() => handleEdit(latest)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {dailySignal.signals.map((s, i) => (
                      <Alert
                        key={i}
                        severity={s.sentiment === 'bullish' ? 'success' : s.sentiment === 'bearish' ? 'error' : 'warning'}
                        sx={{ mb: 0.8 }}
                        icon={false}
                      >
                        <Typography variant="body2">
                          {s.sentiment === 'bullish' ? '📈' : s.sentiment === 'bearish' ? '📉' : '⚠️'} {s.text}
                        </Typography>
                      </Alert>
                    ))}
                    {dailySignal.signals.length === 0 && (
                      <Typography variant="body2" color="text.secondary">No significant signals — fill in more data for insights.</Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Data Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* US Futures */}
                <Grid item xs={6} sm={4} md={2}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">S&P 500 Futures</Typography>
                      <Typography variant="h6" fontWeight={700}>{latest.spFutures || '—'}</Typography>
                      <ChangeChip value={latest.spFuturesChange} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Nasdaq Futures</Typography>
                      <Typography variant="h6" fontWeight={700}>{latest.nasdaqFutures || '—'}</Typography>
                      <ChangeChip value={latest.nasdaqFuturesChange} />
                    </CardContent>
                  </Card>
                </Grid>
                {/* DXY */}
                <Grid item xs={6} sm={4} md={2}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Dollar Index (DXY)</Typography>
                      <Typography variant="h6" fontWeight={700}>{latest.dxy || '—'}</Typography>
                      <ChangeChip value={latest.dxyChange} inverted />
                      <Box sx={{ mt: 0.5 }}>
                        <ImpactTag label="DXY" value={latest.dxyChange} bullishIf="negative" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                {/* US 10Y */}
                <Grid item xs={6} sm={4} md={2}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">US 10Y Yield</Typography>
                      <Typography variant="h6" fontWeight={700}>{latest.us10y ? `${latest.us10y}%` : '—'}</Typography>
                      <ChangeChip value={latest.us10yChange} inverted />
                      <Box sx={{ mt: 0.5 }}>
                        <ImpactTag label="Yield" value={latest.us10yChange} bullishIf="negative" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                {/* Crude */}
                <Grid item xs={6} sm={4} md={2}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Crude Oil (Brent)</Typography>
                      <Typography variant="h6" fontWeight={700}>{latest.crudeOil ? `$${latest.crudeOil}` : '—'}</Typography>
                      <ChangeChip value={latest.crudeOilChange} inverted />
                      <Box sx={{ mt: 0.5 }}>
                        <ImpactTag label="Crude" value={latest.crudeOilChange} bullishIf="negative" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                {/* India VIX */}
                <Grid item xs={6} sm={4} md={2}>
                  <Card sx={{
                    border: '1px solid',
                    borderColor: Number(latest.indiaVix) > 18 ? 'error.main' : Number(latest.indiaVix) < 13 ? 'success.main' : 'warning.main',
                  }}>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">India VIX</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{
                        color: Number(latest.indiaVix) > 18 ? 'error.main' : Number(latest.indiaVix) < 13 ? 'success.main' : 'warning.main',
                      }}>
                        {latest.indiaVix || '—'}
                      </Typography>
                      <ChangeChip value={latest.indiaVixChange} inverted />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Event tags & notes */}
              <Grid container spacing={2}>
                {(latest.isWeeklyExpiry || latest.isMonthlyExpiry || latest.specialEvents) && (
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>📅 Special Events</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {latest.isWeeklyExpiry && <Chip icon={<Event />} label="Weekly Expiry" color="warning" />}
                          {latest.isMonthlyExpiry && <Chip icon={<Warning />} label="Monthly Expiry" color="error" />}
                          {latest.specialEvents && <Chip label={latest.specialEvents} variant="outlined" />}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {latest.notes && (
                  <Grid item xs={12} md={latest.isWeeklyExpiry || latest.isMonthlyExpiry || latest.specialEvents ? 6 : 12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>📝 Notes</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{latest.notes}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </>
      )}

      {/* ═══ HEDGE DESK ═══ */}
      {view === 'hedge' && (
        <>
          {!hedgeAdvice ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              Log today's market context first to get hedge recommendations and a trading checklist.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {/* Risk Dashboard Header */}
              <Grid item xs={12}>
                <Card sx={{ border: '2px solid', borderColor: `${hedgeAdvice.riskColor}.main` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Shield sx={{ fontSize: 36, color: `${hedgeAdvice.riskColor}.main` }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6">
                          Risk Environment: <Chip label={hedgeAdvice.riskLevel} color={hedgeAdvice.riskColor} sx={{ fontWeight: 700, fontSize: 14, ml: 1 }} />
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Max risk/trade: <strong>{hedgeAdvice.maxRiskPct}%</strong> of capital &nbsp;|&nbsp;
                          Position sizing: <strong>{hedgeAdvice.suggestedLots}</strong> of normal &nbsp;|&nbsp;
                          Global score: <strong>{dailySignal?.score ?? 0}</strong> ({dailySignal?.label})
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Checklist</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{
                          color: checkedCount === totalChecks && totalChecks > 0 ? 'success.main' : 'warning.main',
                        }}>
                          {checkedCount}/{totalChecks}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Hedge Strategies */}
              <Grid item xs={12} md={7}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Shield sx={{ color: 'primary.main' }} />
                      <Typography variant="h6">Hedge Strategies ({hedgeAdvice.strategies.length})</Typography>
                    </Box>
                    {hedgeAdvice.strategies.length === 0 ? (
                      <Alert severity="success">Market conditions are neutral — no urgent hedges needed. Stick to normal position sizing.</Alert>
                    ) : (
                      hedgeAdvice.strategies.map((s, i) => (
                        <Card key={i} variant="outlined" sx={{ mb: 1.5, bgcolor: 'background.default' }}>
                          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              {s.type === 'protection' && <Shield fontSize="small" color="error" />}
                              {s.type === 'directional' && <TrendingUp fontSize="small" color="primary" />}
                              {s.type === 'income' && <AttachMoney fontSize="small" color="success" />}
                              {s.type === 'volatility' && <Speed fontSize="small" color="warning" />}
                              {s.type === 'risk-mgmt' && <WarningAmber fontSize="small" color="error" />}
                              {s.type === 'time-decay' && <Calculate fontSize="small" color="info" />}
                              {s.type === 'sector-hedge' && <LocalFireDepartment fontSize="small" color="warning" />}
                              <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                                {s.name}
                              </Typography>
                              <Chip
                                label={s.urgency}
                                size="small"
                                color={s.urgency === 'high' ? 'error' : s.urgency === 'medium' ? 'warning' : 'default'}
                                sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                              />
                              <Chip label={s.type} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {s.rationale}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'info.main' }}>
                              💰 {s.cost}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Pre-Market Checklist */}
              <Grid item xs={12} md={5}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <PlaylistAddCheck sx={{ color: 'primary.main' }} />
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>Pre-Market Checklist</Typography>
                      <Chip
                        label={checkedCount === totalChecks && totalChecks > 0 ? '✅ Ready' : `${checkedCount}/${totalChecks}`}
                        color={checkedCount === totalChecks && totalChecks > 0 ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    {hedgeAdvice.checklist.map((c, i) => (
                      <Box
                        key={i}
                        onClick={() => toggleCheck(i)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, py: 0.8, px: 1,
                          cursor: 'pointer', borderRadius: 1,
                          bgcolor: checklistState[i] ? 'action.selected' : 'transparent',
                          textDecoration: checklistState[i] ? 'line-through' : 'none',
                          opacity: checklistState[i] ? 0.6 : 1,
                          '&:hover': { bgcolor: 'action.hover' },
                          transition: 'all 0.2s',
                        }}
                      >
                        <Checkbox checked={!!checklistState[i]} size="small" sx={{ p: 0 }} />
                        <Typography variant="body2">{c.item}</Typography>
                      </Box>
                    ))}
                    {checkedCount === totalChecks && totalChecks > 0 && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        ✅ All checks complete — you're ready to trade!
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Position Sizer */}
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Calculate sx={{ color: 'primary.main' }} />
                      <Typography variant="h6">Quick Position Sizer</Typography>
                    </Box>
                    <PositionSizer maxRiskPct={hedgeAdvice.maxRiskPct} />
                  </CardContent>
                </Card>

                {/* Day Type Classification */}
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📊 Expected Day Type</Typography>
                    <DayTypeCard dailySignal={dailySignal} latest={latest} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {/* ═══ HISTORY TABLE ═══ */}
      {view === 'history' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Market Context History — {marketContextData.length} entries
            </Typography>
            {marketContextData.length === 0 ? (
              <Alert severity="info">No entries yet. Click "Log Today" to start recording daily market context.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">S&P Fut</TableCell>
                      <TableCell align="right">NQ Fut</TableCell>
                      <TableCell align="right">DXY</TableCell>
                      <TableCell align="right">US 10Y</TableCell>
                      <TableCell align="right">Crude</TableCell>
                      <TableCell align="right">VIX</TableCell>
                      <TableCell>Events</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...marketContextData].reverse().map((entry) => (
                      <TableRow key={entry.date} hover>
                        <TableCell>
                          <strong>{formatDate(entry.date)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          {entry.spFutures || '—'}
                          {entry.spFuturesChange && (
                            <Typography variant="caption" display="block" sx={{ color: Number(entry.spFuturesChange) >= 0 ? 'success.main' : 'error.main' }}>
                              {Number(entry.spFuturesChange) > 0 ? '+' : ''}{entry.spFuturesChange}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {entry.nasdaqFutures || '—'}
                          {entry.nasdaqFuturesChange && (
                            <Typography variant="caption" display="block" sx={{ color: Number(entry.nasdaqFuturesChange) >= 0 ? 'success.main' : 'error.main' }}>
                              {Number(entry.nasdaqFuturesChange) > 0 ? '+' : ''}{entry.nasdaqFuturesChange}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {entry.dxy || '—'}
                          {entry.dxyChange && (
                            <Typography variant="caption" display="block" sx={{ color: Number(entry.dxyChange) <= 0 ? 'success.main' : 'error.main' }}>
                              {Number(entry.dxyChange) > 0 ? '+' : ''}{entry.dxyChange}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {entry.us10y ? `${entry.us10y}%` : '—'}
                          {entry.us10yChange && (
                            <Typography variant="caption" display="block" sx={{ color: Number(entry.us10yChange) <= 0 ? 'success.main' : 'error.main' }}>
                              {Number(entry.us10yChange) > 0 ? '+' : ''}{entry.us10yChange}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {entry.crudeOil ? `$${entry.crudeOil}` : '—'}
                          {entry.crudeOilChange && (
                            <Typography variant="caption" display="block" sx={{ color: Number(entry.crudeOilChange) <= 0 ? 'success.main' : 'error.main' }}>
                              {Number(entry.crudeOilChange) > 0 ? '+' : ''}{entry.crudeOilChange}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{
                            fontWeight: 700,
                            color: Number(entry.indiaVix) > 18 ? 'error.main' : Number(entry.indiaVix) < 13 ? 'success.main' : 'warning.main',
                          }}>
                            {entry.indiaVix || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {entry.isWeeklyExpiry && <Chip label="W" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />}
                            {entry.isMonthlyExpiry && <Chip label="M" size="small" color="error" sx={{ height: 20, fontSize: 10 }} />}
                            {entry.specialEvents && (
                              <Tooltip title={entry.specialEvents}>
                                <Chip label="📅" size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {entry.notes && (
                            <Tooltip title={entry.notes}>
                              <Typography variant="caption" sx={{ maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.notes}
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEdit(entry)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(entry.date)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ CHARTS VIEW ═══ */}
      {view === 'charts' && (
        <Grid container spacing={3}>
          {chartData && Object.keys(dxyChart).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Dollar Index (DXY) Trend</Typography>
                  <Typography variant="caption" color="text.secondary">Rising DXY = FII outflow pressure on Indian markets</Typography>
                  <ReactECharts option={dxyChart} style={{ height: 320 }} />
                </CardContent>
              </Card>
            </Grid>
          )}
          {chartData && Object.keys(yieldChart).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>US 10-Year Yield Trend</Typography>
                  <Typography variant="caption" color="text.secondary">Rising yields = pressure on emerging market equities</Typography>
                  <ReactECharts option={yieldChart} style={{ height: 320 }} />
                </CardContent>
              </Card>
            </Grid>
          )}
          {chartData && Object.keys(crudeChart).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Crude Oil (Brent) Trend</Typography>
                  <Typography variant="caption" color="text.secondary">India is a net importer — high crude = bearish for INR & markets</Typography>
                  <ReactECharts option={crudeChart} style={{ height: 320 }} />
                </CardContent>
              </Card>
            </Grid>
          )}
          {chartData && Object.keys(vixChart).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>India VIX Trend</Typography>
                  <Typography variant="caption" color="text.secondary">&lt;13 = calm (sell premium) | &gt;18 = fear (expect extensions)</Typography>
                  <ReactECharts option={vixChart} style={{ height: 320 }} />
                </CardContent>
              </Card>
            </Grid>
          )}
          {(!chartData || (Object.keys(dxyChart).length === 0 && Object.keys(yieldChart).length === 0 && Object.keys(crudeChart).length === 0 && Object.keys(vixChart).length === 0)) && (
            <Grid item xs={12}>
              <Alert severity="info">Log at least 2 days of market context data to see trend charts.</Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* ═══ ADD / EDIT DIALOG ═══ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editEntry && marketContextData.some((e) => e.date === editEntry.date) ? 'Edit' : 'Log'} Market Context
        </DialogTitle>
        <DialogContent>
          {editEntry && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                {/* Date */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Date"
                    type="date"
                    fullWidth
                    size="small"
                    value={editEntry.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider><Chip label="US Futures (Overnight)" size="small" /></Divider>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="S&P 500 Futures" fullWidth size="small" type="number"
                    value={editEntry.spFutures} onChange={(e) => updateField('spFutures', e.target.value)}
                    placeholder="e.g. 5420" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="S&P Change %" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.spFuturesChange} onChange={(e) => updateField('spFuturesChange', e.target.value)}
                    placeholder="e.g. -0.35" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="Nasdaq Futures" fullWidth size="small" type="number"
                    value={editEntry.nasdaqFutures} onChange={(e) => updateField('nasdaqFutures', e.target.value)}
                    placeholder="e.g. 18900" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="Nasdaq Change %" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.nasdaqFuturesChange} onChange={(e) => updateField('nasdaqFuturesChange', e.target.value)}
                    placeholder="e.g. 0.52" />
                </Grid>

                <Grid item xs={12}>
                  <Divider><Chip label="Dollar / Yields / Crude" size="small" /></Divider>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField label="DXY (Dollar Index)" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.dxy} onChange={(e) => updateField('dxy', e.target.value)}
                    placeholder="e.g. 104.25" />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField label="DXY Chg %" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.dxyChange} onChange={(e) => updateField('dxyChange', e.target.value)}
                    placeholder="-0.15" />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField label="US 10Y Yield" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.us10y} onChange={(e) => updateField('us10y', e.target.value)}
                    placeholder="4.35" />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField label="10Y Chg (bps)" fullWidth size="small" type="number" inputProps={{ step: 0.1 }}
                    value={editEntry.us10yChange} onChange={(e) => updateField('us10yChange', e.target.value)}
                    placeholder="+3" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="Crude Oil (Brent $)" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.crudeOil} onChange={(e) => updateField('crudeOil', e.target.value)}
                    placeholder="82.50" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="Crude Chg %" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.crudeOilChange} onChange={(e) => updateField('crudeOilChange', e.target.value)}
                    placeholder="-1.2" />
                </Grid>

                <Grid item xs={12}>
                  <Divider><Chip label="India VIX" size="small" /></Divider>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="India VIX" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.indiaVix} onChange={(e) => updateField('indiaVix', e.target.value)}
                    placeholder="14.25" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField label="VIX Change %" fullWidth size="small" type="number" inputProps={{ step: 0.01 }}
                    value={editEntry.indiaVixChange} onChange={(e) => updateField('indiaVixChange', e.target.value)}
                    placeholder="-2.5" />
                </Grid>

                <Grid item xs={12}>
                  <Divider><Chip label="Events & Notes" size="small" /></Divider>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControlLabel
                    control={<Checkbox checked={editEntry.isWeeklyExpiry} onChange={(e) => updateField('isWeeklyExpiry', e.target.checked)} />}
                    label="Weekly Expiry"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControlLabel
                    control={<Checkbox checked={editEntry.isMonthlyExpiry} onChange={(e) => updateField('isMonthlyExpiry', e.target.checked)} />}
                    label="Monthly Expiry"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Special Events" fullWidth size="small"
                    value={editEntry.specialEvents} onChange={(e) => updateField('specialEvents', e.target.value)}
                    placeholder="e.g. RBI Policy, US CPI, Fed Meeting" />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Notes / Trading Plan" fullWidth multiline rows={3} size="small"
                    value={editEntry.notes} onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Your pre-market analysis, bias, key levels to watch..." />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!editEntry?.date}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Delete sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
          <Typography variant="h6" gutterBottom>Delete Entry?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Delete market context for <strong>{deleteConfirm ? formatDate(deleteConfirm) : ''}</strong>?
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="outlined" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
