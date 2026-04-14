import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Chip, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import {
  formatDate, aggregateBySymbol, getExpiries, getSymbols, getNearMonthExpiry,
} from '../utils/parsers';
import { classifyBuildup, calculatePCR, formatNum } from '../utils/insights';
import StrikeAnalysis from './StrikeAnalysis';

export default function BhavcopyDashboard() {
  const { bhavcopyData, darkMode } = useData();
  const [view, setView] = useState('futures');
  const [selectedDate, setSelectedDate] = useState('');
  const [segFilter, setSegFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState(null);
  const [sortField, setSortField] = useState('oi');
  const [sortDir, setSortDir] = useState('desc');

  // Get dates for selected view type
  const dates = useMemo(() => {
    return [...new Set(bhavcopyData.filter((d) => d.type === view).map((d) => d.date))].sort();
  }, [bhavcopyData, view]);

  const currentData = useMemo(() => {
    const date = selectedDate || dates[dates.length - 1];
    return bhavcopyData.find((d) => d.type === view && d.date === date) || null;
  }, [bhavcopyData, view, selectedDate, dates]);

  const optionsData = useMemo(() => {
    const date = selectedDate || dates[dates.length - 1];
    return bhavcopyData.find((d) => d.type === 'options' && d.date === date) || null;
  }, [bhavcopyData, selectedDate, dates]);

  // Available filters
  const expiries = useMemo(() => (currentData ? getExpiries(currentData.records) : []), [currentData]);
  const symbols = useMemo(() => (currentData ? getSymbols(currentData.records) : []), [currentData]);
  const nearExpiry = useMemo(() => (currentData ? getNearMonthExpiry(currentData.records) : ''), [currentData]);

  // Active expiry
  const activeExpiry = expiryFilter || nearExpiry;

  // Filtered & aggregated records
  const records = useMemo(() => {
    if (!currentData) return [];
    let recs = currentData.records;
    if (segFilter !== 'All') recs = recs.filter((r) => r.segment === segFilter);
    if (symbolFilter) recs = recs.filter((r) => r.symbol === symbolFilter);

    if (view === 'futures') {
      const agg = aggregateBySymbol(recs, activeExpiry);
      return agg.sort((a, b) => sortDir === 'desc' ? b[sortField] - a[sortField] : a[sortField] - b[sortField]);
    }

    // Options: aggregate by symbol
    const map = {};
    const filtered = recs.filter((r) => !activeExpiry || r.expiry === activeExpiry);
    for (const r of filtered) {
      if (!map[r.symbol]) map[r.symbol] = { symbol: r.symbol, segment: r.segment, callOI: 0, putOI: 0, callVol: 0, putVol: 0, totalOI: 0, totalVol: 0 };
      const m = map[r.symbol];
      if (r.optionType === 'CE') { m.callOI += r.oi; m.callVol += r.volume; }
      else { m.putOI += r.oi; m.putVol += r.volume; }
      m.totalOI += r.oi;
      m.totalVol += r.volume;
    }
    return Object.values(map).sort((a, b) => sortDir === 'desc' ? b[sortField === 'oi' ? 'totalOI' : sortField === 'volume' ? 'totalVol' : 'totalOI'] - a[sortField === 'oi' ? 'totalOI' : sortField === 'volume' ? 'totalVol' : 'totalOI'] : a.totalOI - b.totalOI);
  }, [currentData, view, segFilter, symbolFilter, activeExpiry, sortField, sortDir]);

  /* ───── Top OI Chart ───── */
  const topOIChart = useMemo(() => {
    const top = records.slice(0, 15);
    const field = view === 'futures' ? 'oi' : 'totalOI';
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: top.map((r) => r.symbol).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: top.map((r) => r[field]).reverse(),
        itemStyle: {
          color: (params) => {
            const colors = ['#5c6bc0', '#42a5f5', '#26c6da', '#66bb6a', '#ffca28', '#ff7043', '#ab47bc', '#ec407a', '#8d6e63', '#78909c', '#7e57c2', '#29b6f6', '#9ccc65', '#ffa726', '#ef5350'];
            return colors[params.dataIndex % colors.length];
          },
        },
        barMaxWidth: 30,
      }],
    };
  }, [records, view, darkMode]);

  /* ───── Top Volume Chart ───── */
  const topVolChart = useMemo(() => {
    const field = view === 'futures' ? 'volume' : 'totalVol';
    const top = [...records].sort((a, b) => b[field] - a[field]).slice(0, 15);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: top.map((r) => r.symbol).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: top.map((r) => r[field]).reverse(),
        itemStyle: { color: '#ff9800' },
        barMaxWidth: 30,
      }],
    };
  }, [records, view, darkMode]);

  /* ───── Price change chart (futures only) ───── */
  const priceChangeChart = useMemo(() => {
    if (view !== 'futures') return {};
    const sorted = [...records].filter((r) => r.netChangePct !== 0);
    const gainers = sorted.filter((r) => r.netChangePct > 0).sort((a, b) => b.netChangePct - a.netChangePct).slice(0, 10);
    const losers = sorted.filter((r) => r.netChangePct < 0).sort((a, b) => a.netChangePct - b.netChangePct).slice(0, 10);
    const combined = [...gainers, ...losers.reverse()];
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}: ${p[0].value.toFixed(2)}%` },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => `${v}%` },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: combined.map((r) => r.symbol),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: combined.map((r) => ({
          value: r.netChangePct,
          itemStyle: { color: r.netChangePct >= 0 ? '#4caf50' : '#f44336' },
        })),
        barMaxWidth: 25,
      }],
    };
  }, [records, view, darkMode]);

  /* ───── PCR by symbol (options) ───── */
  const pcrChart = useMemo(() => {
    if (view !== 'options' || !records.length) return {};
    const withPCR = records
      .filter((r) => r.callOI > 0)
      .map((r) => ({ ...r, pcr: r.putOI / r.callOI }))
      .sort((a, b) => b.pcr - a.pcr)
      .slice(0, 20);
    return {
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}: PCR ${p[0].value.toFixed(2)}` },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: withPCR.map((r) => r.symbol).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: withPCR.map((r) => r.pcr).reverse(),
        itemStyle: { color: (p) => p.value > 1 ? '#4caf50' : p.value < 0.7 ? '#f44336' : '#ff9800' },
        barMaxWidth: 25,
        markLine: { data: [{ xAxis: 1, lineStyle: { color: '#fff', type: 'dashed' } }], label: { formatter: 'PCR=1' } },
      }],
    };
  }, [records, view, darkMode]);

  /* ───── Overall PCR card ───── */
  const overallPCR = useMemo(() => {
    if (!optionsData?.records?.length) return null;
    let recs = optionsData.records;
    if (segFilter !== 'All') recs = recs.filter((r) => r.segment === segFilter);
    if (activeExpiry) recs = recs.filter((r) => r.expiry === activeExpiry);
    const overall = calculatePCR(recs);
    const allRecs = activeExpiry ? optionsData.records.filter((r) => r.expiry === activeExpiry) : optionsData.records;
    const indexPCR = calculatePCR(allRecs.filter((r) => r.segment === 'Index'));
    const stockPCR = calculatePCR(allRecs.filter((r) => r.segment === 'Stock'));
    // Symbol-specific PCR
    const symbolPCR = symbolFilter
      ? calculatePCR(allRecs.filter((r) => r.symbol === symbolFilter))
      : null;
    return { ...overall, indexPCR, stockPCR, symbolPCR };
  }, [optionsData, activeExpiry, segFilter, symbolFilter]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Symbol-wise PCR table data
  const symbolPCRData = useMemo(() => {
    if (!optionsData?.records?.length) return [];
    let recs = optionsData.records;
    if (segFilter !== 'All') recs = recs.filter((r) => r.segment === segFilter);
    if (activeExpiry) recs = recs.filter((r) => r.expiry === activeExpiry);
    const map = {};
    for (const r of recs) {
      if (!map[r.symbol]) map[r.symbol] = { symbol: r.symbol, segment: r.segment, callOI: 0, putOI: 0, callVol: 0, putVol: 0 };
      const m = map[r.symbol];
      if (r.optionType === 'CE') { m.callOI += r.oi; m.callVol += r.volume; }
      else { m.putOI += r.oi; m.putVol += r.volume; }
    }
    return Object.values(map)
      .map((m) => ({ ...m, oiPCR: m.callOI > 0 ? m.putOI / m.callOI : 0, volPCR: m.callVol > 0 ? m.putVol / m.callVol : 0, totalOI: m.callOI + m.putOI }))
      .sort((a, b) => b.oiPCR - a.oiPCR);
  }, [optionsData, segFilter, activeExpiry]);

  if (!bhavcopyData.length) {
    return <Alert severity="info">Upload F&amp;O Bhavcopy CSV files (fo*.csv / op*.csv) to view this dashboard.</Alert>;
  }

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="futures">Futures</ToggleButton>
          <ToggleButton value="options">Options</ToggleButton>
        </ToggleButtonGroup>
        {dates.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Date</InputLabel>
            <Select value={selectedDate || dates[dates.length - 1]} label="Date" onChange={(e) => setSelectedDate(e.target.value)}>
              {dates.map((d) => <MenuItem key={d} value={d}>{formatDate(d)}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <ToggleButtonGroup size="small" exclusive value={segFilter} onChange={(_, v) => v && setSegFilter(v)}>
          <ToggleButton value="All">All</ToggleButton>
          <ToggleButton value="Index">Index</ToggleButton>
          <ToggleButton value="Stock">Stock</ToggleButton>
        </ToggleButtonGroup>
        {expiries.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Expiry</InputLabel>
            <Select value={activeExpiry} label="Expiry" onChange={(e) => setExpiryFilter(e.target.value)}>
              {expiries.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <Autocomplete
          size="small"
          options={symbols}
          value={symbolFilter}
          onChange={(_, v) => setSymbolFilter(v)}
          renderInput={(params) => <TextField {...params} label="Symbol" />}
          sx={{ minWidth: 180 }}
          clearOnEscape
        />
      </Box>

      {/* PCR summary cards (when options data available) */}
      {overallPCR && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Symbol-specific PCR card (when a symbol is selected) */}
          {overallPCR.symbolPCR && symbolFilter && (
            <Grid item xs={12} sm={4}>
              <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{symbolFilter} PCR (OI)</Typography>
                  <Typography variant="h4" sx={{ color: overallPCR.symbolPCR.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    {overallPCR.symbolPCR.oiPCR.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Vol PCR: <strong>{overallPCR.symbolPCR.volumePCR.toFixed(2)}</strong></Typography>
                    <Typography variant="caption" color="text.secondary">Put: <strong>{formatNum(overallPCR.symbolPCR.totalPutOI)}</strong></Typography>
                    <Typography variant="caption" color="text.secondary">Call: <strong>{formatNum(overallPCR.symbolPCR.totalCallOI)}</strong></Typography>
                  </Box>
                  <Chip
                    label={overallPCR.symbolPCR.oiPCR > 1.3 ? 'Bullish' : overallPCR.symbolPCR.oiPCR < 0.7 ? 'Bearish' : 'Neutral'}
                    size="small"
                    color={overallPCR.symbolPCR.oiPCR > 1.3 ? 'success' : overallPCR.symbolPCR.oiPCR < 0.7 ? 'error' : 'warning'}
                    sx={{ mt: 0.5, fontWeight: 700 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}
          <Grid item xs={6} sm={symbolFilter ? 2 : 2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Overall PCR (OI)</Typography>
                <Typography variant="h5" sx={{ color: overallPCR.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                  {overallPCR.oiPCR.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Index PCR (OI)</Typography>
                <Typography variant="h5" sx={{ color: overallPCR.indexPCR.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                  {overallPCR.indexPCR.oiPCR.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">Vol: {overallPCR.indexPCR.volumePCR.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Stock PCR (OI)</Typography>
                <Typography variant="h5" sx={{ color: overallPCR.stockPCR.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                  {overallPCR.stockPCR.oiPCR.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">Vol: {overallPCR.stockPCR.volumePCR.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          {!symbolFilter && (
            <>
              <Grid item xs={6} sm={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">PCR (Volume)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{overallPCR.volumePCR.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Total Put OI</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatNum(overallPCR.totalPutOI)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={2}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Total Call OI</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatNum(overallPCR.totalCallOI)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Top by Open Interest</Typography>
              <ReactECharts option={topOIChart} style={{ height: 420 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Top by Volume</Typography>
              <ReactECharts option={topVolChart} style={{ height: 420 }} />
            </CardContent>
          </Card>
        </Grid>
        {view === 'futures' && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Price Change % – Top Gainers &amp; Losers</Typography>
                <ReactECharts option={priceChangeChart} style={{ height: 420 }} />
              </CardContent>
            </Card>
          </Grid>
        )}
        {view === 'options' && records.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>PCR by Symbol</Typography>
                <ReactECharts option={pcrChart} style={{ height: 420 }} />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Symbol-wise PCR Table */}
      {view === 'options' && symbolPCRData.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Symbol-wise PCR ({segFilter === 'All' ? 'All' : segFilter}) — {symbolPCRData.length} symbols
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Segment</TableCell>
                    <TableCell align="right">PCR (OI)</TableCell>
                    <TableCell align="right">PCR (Vol)</TableCell>
                    <TableCell align="right">Put OI</TableCell>
                    <TableCell align="right">Call OI</TableCell>
                    <TableCell align="right">Total OI</TableCell>
                    <TableCell align="right">Sentiment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {symbolPCRData.map((s) => (
                    <TableRow key={s.symbol} hover>
                      <TableCell><strong>{s.symbol}</strong></TableCell>
                      <TableCell><Chip label={s.segment} size="small" variant="outlined" /></TableCell>
                      <TableCell align="right" sx={{ color: s.oiPCR > 1 ? 'success.main' : s.oiPCR < 0.7 ? 'error.main' : 'warning.main', fontWeight: 700 }}>
                        {s.oiPCR.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {s.volPCR.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">{formatNum(s.putOI)}</TableCell>
                      <TableCell align="right">{formatNum(s.callOI)}</TableCell>
                      <TableCell align="right">{formatNum(s.totalOI)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={s.oiPCR > 1.3 ? 'Bullish' : s.oiPCR < 0.7 ? 'Bearish' : 'Neutral'}
                          size="small"
                          color={s.oiPCR > 1.3 ? 'success' : s.oiPCR < 0.7 ? 'error' : 'warning'}
                          sx={{ fontWeight: 600, minWidth: 70 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Strike Analysis (when options view + symbol selected) */}
      {view === 'options' && optionsData?.records?.length > 0 && (
        <StrikeAnalysis
          records={optionsData.records.filter((r) => segFilter === 'All' || r.segment === segFilter)}
          symbol={symbolFilter || (records[0]?.symbol) || ''}
          expiry={activeExpiry}
          darkMode={darkMode}
        />
      )}

      {/* Data table */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {view === 'futures' ? 'Futures' : 'Options'} Data ({records.length} symbols)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                {view === 'futures' ? (
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Segment</TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'closePrice'} direction={sortDir} onClick={() => handleSort('closePrice')}>Price</TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'netChangePct'} direction={sortDir} onClick={() => handleSort('netChangePct')}>Change %</TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'oi'} direction={sortDir} onClick={() => handleSort('oi')}>OI</TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'volume'} direction={sortDir} onClick={() => handleSort('volume')}>Volume</TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={sortField === 'tradedValue'} direction={sortDir} onClick={() => handleSort('tradedValue')}>Value</TableSortLabel>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Segment</TableCell>
                    <TableCell align="right">Call OI</TableCell>
                    <TableCell align="right">Put OI</TableCell>
                    <TableCell align="right">Total OI</TableCell>
                    <TableCell align="right">Call Vol</TableCell>
                    <TableCell align="right">Put Vol</TableCell>
                    <TableCell align="right">PCR</TableCell>
                  </TableRow>
                )}
              </TableHead>
              <TableBody>
                {(view === 'futures' ? records : records).slice(0, 200).map((r) => (
                  view === 'futures' ? (
                    <TableRow key={r.symbol} hover>
                      <TableCell><strong>{r.symbol}</strong></TableCell>
                      <TableCell><Chip label={r.segment} size="small" variant="outlined" /></TableCell>
                      <TableCell align="right">{r.closePrice?.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: r.netChangePct >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                        {r.netChangePct >= 0 ? '+' : ''}{r.netChangePct?.toFixed(2)}%
                      </TableCell>
                      <TableCell align="right">{formatNum(r.oi)}</TableCell>
                      <TableCell align="right">{formatNum(r.volume)}</TableCell>
                      <TableCell align="right">{formatNum(r.tradedValue)}</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={r.symbol} hover>
                      <TableCell><strong>{r.symbol}</strong></TableCell>
                      <TableCell><Chip label={r.segment} size="small" variant="outlined" /></TableCell>
                      <TableCell align="right">{formatNum(r.callOI)}</TableCell>
                      <TableCell align="right">{formatNum(r.putOI)}</TableCell>
                      <TableCell align="right"><strong>{formatNum(r.totalOI)}</strong></TableCell>
                      <TableCell align="right">{formatNum(r.callVol)}</TableCell>
                      <TableCell align="right">{formatNum(r.putVol)}</TableCell>
                      <TableCell align="right" sx={{ color: r.callOI > 0 && r.putOI / r.callOI > 1 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                        {r.callOI > 0 ? (r.putOI / r.callOI).toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
