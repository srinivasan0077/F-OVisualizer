import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Chip, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  Divider, Tooltip,
} from '@mui/material';
import {
  OilBarrel, Diamond, CurrencyExchange, LocalFireDepartment,
  TrendingUp, TrendingDown,
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import {
  formatDate, getExpiries, COMMODITY_INFO, getCommodityName, getCommodityCategory,
} from '../utils/parsers';
import { formatNum } from '../utils/insights';

/* ── Category icons & colors ── */
const CATEGORY_META = {
  Energy: { icon: '🛢️', color: '#ff7043' },
  'Precious Metals': { icon: '🥇', color: '#ffd54f' },
  'Base Metals': { icon: '⚙️', color: '#78909c' },
  Agri: { icon: '🌾', color: '#66bb6a' },
  Currency: { icon: '💱', color: '#42a5f5' },
  Other: { icon: '📦', color: '#ab47bc' },
};

export default function CommodityDashboard() {
  const { commodityData, darkMode } = useData();
  const [view, setView] = useState('overview');
  const [selectedDate, setSelectedDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [symbolFilter, setSymbolFilter] = useState(null);
  const [expiryFilter, setExpiryFilter] = useState('');
  const [sortField, setSortField] = useState('oi');
  const [sortDir, setSortDir] = useState('desc');

  const dates = useMemo(() => commodityData.map((d) => d.date), [commodityData]);
  const activeDate = selectedDate || dates[dates.length - 1] || '';
  const currentData = useMemo(
    () => commodityData.find((d) => d.date === activeDate) || null,
    [commodityData, activeDate],
  );

  /* ── Futures aggregation ── */
  const futuresAgg = useMemo(() => {
    if (!currentData) return [];
    let recs = currentData.futuresRecords;
    if (categoryFilter !== 'All') recs = recs.filter((r) => getCommodityCategory(r.symbol) === categoryFilter);
    if (symbolFilter) recs = recs.filter((r) => r.symbol === symbolFilter);

    // Aggregate by symbol (across expiries, or filtered)
    const nearExpMap = {};
    const symbols = [...new Set(recs.map((r) => r.symbol))];
    for (const sym of symbols) {
      const symRecs = recs.filter((r) => r.symbol === sym);
      const expiries = [...new Set(symRecs.map((r) => r.expiry))].sort((a, b) => new Date(a) - new Date(b));
      const activeExp = expiryFilter || expiries[0];
      const filtered = expiryFilter ? symRecs.filter((r) => r.expiry === expiryFilter) : symRecs.filter((r) => r.expiry === expiries[0]);

      if (filtered.length === 0) continue;
      const r = filtered[0]; // Near-month contract
      const totalOI = symRecs.reduce((s, x) => s + x.oi, 0);
      const totalVol = symRecs.reduce((s, x) => s + x.volume, 0);

      nearExpMap[sym] = {
        symbol: sym,
        name: getCommodityName(sym),
        category: getCommodityCategory(sym),
        expiry: r.expiry,
        expiryCount: expiries.length,
        closePrice: r.closePrice,
        previousSettle: r.previousSettle,
        netChangePct: r.netChangePct,
        highPrice: r.highPrice,
        lowPrice: r.lowPrice,
        oi: r.oi,
        oiTotal: totalOI,
        volume: r.volume,
        volumeTotal: totalVol,
        settlementPrice: r.settlementPrice,
        tradedValue: r.tradedValue,
        lotSize: COMMODITY_INFO[sym]?.lotSize || 1,
        unit: COMMODITY_INFO[sym]?.unit || '',
      };
    }

    return Object.values(nearExpMap).sort((a, b) =>
      sortDir === 'desc' ? (b[sortField] || 0) - (a[sortField] || 0) : (a[sortField] || 0) - (b[sortField] || 0),
    );
  }, [currentData, categoryFilter, symbolFilter, expiryFilter, sortField, sortDir]);

  /* ── Options data ── */
  const optionsAgg = useMemo(() => {
    if (!currentData || !currentData.optionsRecords.length) return [];
    let recs = currentData.optionsRecords;
    if (symbolFilter) recs = recs.filter((r) => r.symbol === symbolFilter);
    return recs;
  }, [currentData, symbolFilter]);

  /* ── Available symbols & categories ── */
  const allSymbols = useMemo(() => {
    if (!currentData) return [];
    return [...new Set(currentData.futuresRecords.map((r) => r.symbol))].sort();
  }, [currentData]);

  const allCategories = useMemo(() => {
    if (!currentData) return [];
    const cats = new Set(currentData.futuresRecords.map((r) => getCommodityCategory(r.symbol)));
    return ['All', ...Array.from(cats).sort()];
  }, [currentData]);

  const allExpiries = useMemo(() => {
    if (!currentData) return [];
    let recs = currentData.futuresRecords;
    if (symbolFilter) recs = recs.filter((r) => r.symbol === symbolFilter);
    return getExpiries(recs);
  }, [currentData, symbolFilter]);

  /* ── Category summary for overview ── */
  const categorySummary = useMemo(() => {
    if (!futuresAgg.length) return [];
    const map = {};
    for (const r of futuresAgg) {
      if (!map[r.category]) map[r.category] = { category: r.category, totalOI: 0, totalVolume: 0, symbols: 0, gainers: 0, losers: 0 };
      map[r.category].totalOI += r.oiTotal;
      map[r.category].totalVolume += r.volumeTotal;
      map[r.category].symbols += 1;
      if (r.netChangePct > 0) map[r.category].gainers++;
      else if (r.netChangePct < 0) map[r.category].losers++;
    }
    return Object.values(map).sort((a, b) => b.totalOI - a.totalOI);
  }, [futuresAgg]);

  /* ── Multi-day OI trend for selected symbol ── */
  const oiTrendChart = useMemo(() => {
    if (!symbolFilter || commodityData.length < 2) return {};
    const trendData = [];
    for (const day of commodityData) {
      const symRecs = day.futuresRecords.filter((r) => r.symbol === symbolFilter);
      if (!symRecs.length) continue;
      const nearExp = [...new Set(symRecs.map((r) => r.expiry))].sort((a, b) => new Date(a) - new Date(b))[0];
      const nr = symRecs.find((r) => r.expiry === nearExp);
      if (nr) trendData.push({ date: day.date, oi: nr.oi, close: nr.closePrice, volume: nr.volume });
    }
    if (trendData.length < 2) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['OI', 'Close Price', 'Volume'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 60, right: 60, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: trendData.map((d) => formatDate(d.date)), axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: [
        { type: 'value', name: 'OI / Volume', axisLabel: { color: darkMode ? '#ccc' : '#333' }, splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } } },
        { type: 'value', name: 'Price', axisLabel: { color: darkMode ? '#ccc' : '#333' }, splitLine: { show: false } },
      ],
      series: [
        { name: 'OI', type: 'bar', data: trendData.map((d) => d.oi), itemStyle: { color: '#42a5f5' }, opacity: 0.7 },
        { name: 'Volume', type: 'bar', data: trendData.map((d) => d.volume), itemStyle: { color: '#78909c' }, opacity: 0.5 },
        { name: 'Close Price', type: 'line', yAxisIndex: 1, data: trendData.map((d) => d.close), lineStyle: { width: 2.5, color: '#ff9800' }, symbol: 'circle', symbolSize: 5 },
      ],
    };
  }, [symbolFilter, commodityData, darkMode]);

  /* ── OI Treemap ── */
  const treemapChart = useMemo(() => {
    if (!futuresAgg.length) return {};
    const catMap = {};
    for (const r of futuresAgg) {
      if (!catMap[r.category]) catMap[r.category] = { name: r.category, children: [] };
      catMap[r.category].children.push({
        name: r.name,
        value: r.oiTotal,
        changePct: r.netChangePct,
      });
    }
    return {
      tooltip: {
        formatter: (p) => {
          const d = p.data;
          return `<b>${d.name}</b><br/>OI: ${formatNum(d.value)}<br/>Change: ${d.changePct != null ? d.changePct.toFixed(2) + '%' : '—'}`;
        },
      },
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, formatter: '{b}', fontSize: 11 },
        upperLabel: { show: true, height: 24, color: '#fff', fontWeight: 700 },
        itemStyle: { borderColor: darkMode ? '#1e1e1e' : '#fff', borderWidth: 2 },
        levels: [
          { itemStyle: { borderWidth: 3 }, upperLabel: { show: true } },
          {
            colorSaturation: [0.3, 0.7],
            itemStyle: { borderColorSaturation: 0.6 },
          },
        ],
        data: Object.values(catMap).map((cat) => ({
          ...cat,
          itemStyle: { color: CATEGORY_META[cat.name]?.color || '#9e9e9e' },
          children: cat.children.map((c) => ({
            ...c,
            itemStyle: {
              color: c.changePct > 0 ? '#4caf50' : c.changePct < 0 ? '#ef5350' : '#ff9800',
            },
          })),
        })),
      }],
    };
  }, [futuresAgg, darkMode]);

  /* ── Options chain for selected symbol ── */
  const optionsChain = useMemo(() => {
    if (!symbolFilter || !optionsAgg.length) return { strikes: [], expiry: '' };
    const expiries = [...new Set(optionsAgg.map((r) => r.expiry))].sort((a, b) => new Date(a) - new Date(b));
    const activeExp = expiryFilter || expiries[0];
    const filtered = optionsAgg.filter((r) => r.expiry === activeExp);
    const strikeMap = {};
    for (const r of filtered) {
      if (!strikeMap[r.strikePrice]) strikeMap[r.strikePrice] = { strike: r.strikePrice, ceOI: 0, peOI: 0, ceVol: 0, peVol: 0, ceClose: 0, peClose: 0 };
      if (r.optionType === 'CE') {
        strikeMap[r.strikePrice].ceOI = r.oi;
        strikeMap[r.strikePrice].ceVol = r.volume;
        strikeMap[r.strikePrice].ceClose = r.closePrice;
      } else {
        strikeMap[r.strikePrice].peOI = r.oi;
        strikeMap[r.strikePrice].peVol = r.volume;
        strikeMap[r.strikePrice].peClose = r.closePrice;
      }
    }
    const strikes = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);
    return { strikes, expiry: activeExp, expiries };
  }, [symbolFilter, optionsAgg, expiryFilter]);

  /* ── Options OI chart ── */
  const optionsChart = useMemo(() => {
    if (!optionsChain.strikes.length) return {};
    const s = optionsChain.strikes;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Call OI', 'Put OI'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 60, right: 30, top: 40, bottom: 40 },
      xAxis: { type: 'category', data: s.map((x) => x.strike), axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45 } },
      yAxis: { type: 'value', axisLabel: { color: darkMode ? '#ccc' : '#333' }, splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } } },
      series: [
        { name: 'Call OI', type: 'bar', data: s.map((x) => x.ceOI), itemStyle: { color: '#ef5350' } },
        { name: 'Put OI', type: 'bar', data: s.map((x) => x.peOI), itemStyle: { color: '#4caf50' } },
      ],
    };
  }, [optionsChain, darkMode]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  if (commodityData.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No commodity data loaded yet. Upload MCX / commodity bhavcopy CSV files to see data here.
        <br />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Supported formats: MCX bhavcopy with FUTCOM/OPTFUT/FUTCUR/OPTCUR contracts
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <OilBarrel sx={{ color: 'primary.main', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Commodities & Currency F&O
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="overview">Overview</ToggleButton>
          <ToggleButton value="futures">Futures</ToggleButton>
          <ToggleButton value="options">Options</ToggleButton>
          <ToggleButton value="trend">Trend</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Date</InputLabel>
          <Select value={activeDate} label="Date" onChange={(e) => setSelectedDate(e.target.value)}>
            {dates.map((d) => <MenuItem key={d} value={d}>{formatDate(d)}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Category</InputLabel>
          <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
            {allCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          sx={{ minWidth: 180 }}
          options={allSymbols}
          getOptionLabel={(s) => `${getCommodityName(s)} (${s})`}
          value={symbolFilter}
          onChange={(_, v) => setSymbolFilter(v)}
          renderInput={(params) => <TextField {...params} label="Symbol" />}
        />
        {allExpiries.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Expiry</InputLabel>
            <Select value={expiryFilter} label="Expiry" onChange={(e) => setExpiryFilter(e.target.value)}>
              <MenuItem value="">Near Month</MenuItem>
              {allExpiries.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <Chip label={`${currentData?.totalFutures || 0} fut / ${currentData?.totalOptions || 0} opt contracts`} variant="outlined" size="small" />
      </Box>

      {/* ═══ OVERVIEW ═══ */}
      {view === 'overview' && (
        <Grid container spacing={3}>
          {/* Category cards */}
          {categorySummary.map((cat) => {
            const meta = CATEGORY_META[cat.category] || CATEGORY_META.Other;
            return (
              <Grid item xs={6} sm={4} md={2.4} key={cat.category}>
                <Card sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }, border: '1px solid', borderColor: categoryFilter === cat.category ? 'primary.main' : 'divider' }}
                  onClick={() => setCategoryFilter(categoryFilter === cat.category ? 'All' : cat.category)}>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h4">{meta.icon}</Typography>
                    <Typography variant="subtitle2" fontWeight={700}>{cat.category}</Typography>
                    <Typography variant="caption" color="text.secondary">{cat.symbols} contracts</Typography>
                    <Divider sx={{ my: 0.8 }} />
                    <Typography variant="body2">OI: <strong>{formatNum(cat.totalOI)}</strong></Typography>
                    <Typography variant="body2">Vol: <strong>{formatNum(cat.totalVolume)}</strong></Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.5 }}>
                      <Chip label={`↑${cat.gainers}`} size="small" color="success" sx={{ height: 20, fontSize: 10 }} />
                      <Chip label={`↓${cat.losers}`} size="small" color="error" sx={{ height: 20, fontSize: 10 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}

          {/* OI Treemap */}
          {Object.keys(treemapChart).length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Commodity OI Heatmap</Typography>
                  <Typography variant="caption" color="text.secondary">Size = OI, Color = Green (up) / Red (down)</Typography>
                  <ReactECharts option={treemapChart} style={{ height: 400 }} />
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Top movers */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                  <TrendingUp sx={{ verticalAlign: 'middle', mr: 1 }} /> Top Gainers
                </Typography>
                {futuresAgg.filter((r) => r.netChangePct > 0).sort((a, b) => b.netChangePct - a.netChangePct).slice(0, 8).map((r) => (
                  <Box key={r.symbol} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ minWidth: 80 }}>{CATEGORY_META[r.category]?.icon} {r.name}</Typography>
                    <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'right' }}>₹{formatNum(r.closePrice)}</Typography>
                    <Chip label={`+${r.netChangePct.toFixed(2)}%`} size="small" color="success" sx={{ fontWeight: 700, minWidth: 80 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, textAlign: 'right' }}>OI: {formatNum(r.oi)}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'error.main' }}>
                  <TrendingDown sx={{ verticalAlign: 'middle', mr: 1 }} /> Top Losers
                </Typography>
                {futuresAgg.filter((r) => r.netChangePct < 0).sort((a, b) => a.netChangePct - b.netChangePct).slice(0, 8).map((r) => (
                  <Box key={r.symbol} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ minWidth: 80 }}>{CATEGORY_META[r.category]?.icon} {r.name}</Typography>
                    <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'right' }}>₹{formatNum(r.closePrice)}</Typography>
                    <Chip label={`${r.netChangePct.toFixed(2)}%`} size="small" color="error" sx={{ fontWeight: 700, minWidth: 80 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, textAlign: 'right' }}>OI: {formatNum(r.oi)}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ═══ FUTURES TABLE ═══ */}
      {view === 'futures' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Commodity Futures — {formatDate(activeDate)} ({futuresAgg.length} contracts)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Expiry</TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'closePrice'} direction={sortField === 'closePrice' ? sortDir : 'desc'} onClick={() => handleSort('closePrice')}>
                        Close
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'netChangePct'} direction={sortField === 'netChangePct' ? sortDir : 'desc'} onClick={() => handleSort('netChangePct')}>
                        Change %
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'oi'} direction={sortField === 'oi' ? sortDir : 'desc'} onClick={() => handleSort('oi')}>
                        OI (Near)
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'oiTotal'} direction={sortField === 'oiTotal' ? sortDir : 'desc'} onClick={() => handleSort('oiTotal')}>
                        OI (Total)
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'volume'} direction={sortField === 'volume' ? sortDir : 'desc'} onClick={() => handleSort('volume')}>
                        Volume
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Range</TableCell>
                    <TableCell align="right">Lot</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {futuresAgg.map((r) => (
                    <TableRow
                      key={r.symbol}
                      hover
                      sx={{ cursor: 'pointer', bgcolor: symbolFilter === r.symbol ? 'action.selected' : 'inherit' }}
                      onClick={() => setSymbolFilter(symbolFilter === r.symbol ? null : r.symbol)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{CATEGORY_META[r.category]?.icon}</span>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.symbol}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.category} size="small" sx={{ bgcolor: CATEGORY_META[r.category]?.color, color: '#fff', fontWeight: 600, fontSize: 10, height: 20 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{r.expiry}</Typography>
                        {r.expiryCount > 1 && <Typography variant="caption" display="block" color="text.secondary">+{r.expiryCount - 1} more</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>₹{formatNum(r.closePrice)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} sx={{ color: r.netChangePct > 0 ? 'success.main' : r.netChangePct < 0 ? 'error.main' : 'text.primary' }}>
                          {r.netChangePct > 0 ? '+' : ''}{r.netChangePct.toFixed(2)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatNum(r.oi)}</TableCell>
                      <TableCell align="right">{formatNum(r.oiTotal)}</TableCell>
                      <TableCell align="right">{formatNum(r.volume)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{formatNum(r.lowPrice)} — {formatNum(r.highPrice)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={`Lot: ${r.lotSize} ${r.unit}`}>
                          <Typography variant="caption">{r.lotSize} {r.unit}</Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ═══ OPTIONS VIEW ═══ */}
      {view === 'options' && (
        <>
          {!symbolFilter ? (
            <Alert severity="info">Select a commodity symbol from the filters above to view its options chain.</Alert>
          ) : optionsChain.strikes.length === 0 ? (
            <Alert severity="warning">No options data available for <strong>{getCommodityName(symbolFilter)}</strong> on this date.</Alert>
          ) : (
            <Grid container spacing={3}>
              {/* OI chart */}
              {Object.keys(optionsChart).length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {getCommodityName(symbolFilter)} Options OI — {optionsChain.expiry}
                      </Typography>
                      <ReactECharts option={optionsChart} style={{ height: 350 }} />
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Strike table */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Options Chain ({optionsChain.strikes.length} strikes)
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell align="right">CE OI</TableCell>
                            <TableCell align="right">CE Vol</TableCell>
                            <TableCell align="right">CE Price</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'primary.main', color: '#fff' }}>Strike</TableCell>
                            <TableCell align="right">PE Price</TableCell>
                            <TableCell align="right">PE Vol</TableCell>
                            <TableCell align="right">PE OI</TableCell>
                            <TableCell align="right">PCR</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {optionsChain.strikes.map((s) => {
                            const pcr = s.ceOI > 0 ? (s.peOI / s.ceOI).toFixed(2) : '—';
                            return (
                              <TableRow key={s.strike} hover>
                                <TableCell align="right" sx={{ color: 'error.main' }}>{formatNum(s.ceOI)}</TableCell>
                                <TableCell align="right">{formatNum(s.ceVol)}</TableCell>
                                <TableCell align="right">{s.ceClose ? `₹${formatNum(s.ceClose)}` : '—'}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>{s.strike}</TableCell>
                                <TableCell align="right">{s.peClose ? `₹${formatNum(s.peClose)}` : '—'}</TableCell>
                                <TableCell align="right">{formatNum(s.peVol)}</TableCell>
                                <TableCell align="right" sx={{ color: 'success.main' }}>{formatNum(s.peOI)}</TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" sx={{ color: Number(pcr) > 1 ? 'success.main' : Number(pcr) < 0.7 ? 'error.main' : 'text.primary' }}>
                                    {pcr}
                                  </Typography>
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
        </>
      )}

      {/* ═══ TREND VIEW ═══ */}
      {view === 'trend' && (
        <>
          {!symbolFilter ? (
            <Alert severity="info">Select a commodity symbol to view multi-day OI / price trends.</Alert>
          ) : Object.keys(oiTrendChart).length === 0 ? (
            <Alert severity="warning">Need at least 2 days of data for <strong>{getCommodityName(symbolFilter)}</strong> to show trends.</Alert>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {getCommodityName(symbolFilter)} — OI & Price Trend
                </Typography>
                <ReactECharts option={oiTrendChart} style={{ height: 400 }} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
