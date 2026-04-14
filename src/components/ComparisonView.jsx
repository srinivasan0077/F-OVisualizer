import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, FormControl, InputLabel,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate, aggregateBySymbol, getNearMonthExpiry } from '../utils/parsers';
import { formatNum, classifyBuildup, generateComparisonInsights } from '../utils/insights';

export default function ComparisonView() {
  const { participantData, bhavcopyData, darkMode } = useData();
  const [date1, setDate1] = useState('');
  const [date2, setDate2] = useState('');
  const [bhavView, setBhavView] = useState('futures');
  const [segFilter, setSegFilter] = useState('All');

  const pDates = participantData.map((d) => d.date);
  const futData = bhavcopyData.filter((d) => d.type === 'futures');
  const optData = bhavcopyData.filter((d) => d.type === 'options');
  const fDates = [...new Set(futData.map((d) => d.date))].sort();
  const oDates = [...new Set(optData.map((d) => d.date))].sort();

  const allDates = [...new Set([...pDates, ...fDates, ...oDates])].sort();

  // Auto-select newest two dates
  const effectiveDate1 = date1 || allDates[allDates.length - 2] || '';
  const effectiveDate2 = date2 || allDates[allDates.length - 1] || '';

  const pPrev = participantData.find((d) => d.date === effectiveDate1);
  const pCurr = participantData.find((d) => d.date === effectiveDate2);

  /* ───── Participant position change chart ───── */
  const participantChangeChart = useMemo(() => {
    if (!pPrev || !pCurr) return null;

    const types = pCurr.participants.map((p) => p.clientType);
    const futChange = types.map((t) => {
      const prev = pPrev.participants.find((p) => p.clientType === t);
      const curr = pCurr.participants.find((p) => p.clientType === t);
      if (!prev || !curr) return 0;
      const prevNet = (prev.futIdxL + prev.futStkL) - (prev.futIdxS + prev.futStkS);
      const currNet = (curr.futIdxL + curr.futStkL) - (curr.futIdxS + curr.futStkS);
      return currNet - prevNet;
    });
    const optChange = types.map((t) => {
      const prev = pPrev.participants.find((p) => p.clientType === t);
      const curr = pCurr.participants.find((p) => p.clientType === t);
      if (!prev || !curr) return 0;
      const prevNet = (prev.optIdxCL + prev.optIdxPL + prev.optStkCL + prev.optStkPL) - (prev.optIdxCS + prev.optIdxPS + prev.optStkCS + prev.optStkPS);
      const currNet = (curr.optIdxCL + curr.optIdxPL + curr.optStkCL + curr.optStkPL) - (curr.optIdxCS + curr.optIdxPS + curr.optStkCS + curr.optStkPS);
      return currNet - prevNet;
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: types, axisLabel: { color: darkMode ? '#ccc' : '#333' } },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'Net Futures Change',
          type: 'bar',
          data: futChange.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#4caf50' : '#f44336' } })),
          barMaxWidth: 50,
        },
        {
          name: 'Net Options Change',
          type: 'bar',
          data: optChange.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#66bb6a' : '#ef5350' } })),
          barMaxWidth: 50,
        },
      ],
    };
  }, [pPrev, pCurr, darkMode]);

  /* ───── Participant detail change table ───── */
  const participantChangeTable = useMemo(() => {
    if (!pPrev || !pCurr) return [];
    return pCurr.participants.map((curr) => {
      const prev = pPrev.participants.find((p) => p.clientType === curr.clientType);
      if (!prev) return null;
      const fields = ['futIdxL', 'futIdxS', 'futStkL', 'futStkS', 'totalLong', 'totalShort'];
      const row = { clientType: curr.clientType };
      for (const f of fields) {
        row[`${f}_prev`] = prev[f];
        row[`${f}_curr`] = curr[f];
        row[`${f}_change`] = curr[f] - prev[f];
        row[`${f}_pct`] = prev[f] ? ((curr[f] - prev[f]) / prev[f] * 100) : 0;
      }
      return row;
    }).filter(Boolean);
  }, [pPrev, pCurr]);

  /* ───── Bhavcopy OI change (futures) ───── */
  const futOiChangeData = useMemo(() => {
    const f1 = futData.find((d) => d.date === effectiveDate1);
    const f2 = futData.find((d) => d.date === effectiveDate2);
    if (!f1 || !f2) return [];

    const exp1 = getNearMonthExpiry(f1.records);
    const exp2 = getNearMonthExpiry(f2.records);
    const agg1 = aggregateBySymbol(f1.records, exp1);
    const agg2 = aggregateBySymbol(f2.records, exp2);

    const map1 = Object.fromEntries(agg1.map((r) => [r.symbol, r]));
    const results = [];

    for (const r2 of agg2) {
      const r1 = map1[r2.symbol];
      if (!r1) continue;
      const oiChange = r2.oi - r1.oi;
      const pctOIChange = r1.oi ? ((r2.oi - r1.oi) / r1.oi * 100) : 0;
      const buildup = classifyBuildup(r2.netChangePct, oiChange);
      results.push({
        symbol: r2.symbol,
        segment: r2.segment,
        prevOI: r1.oi,
        currOI: r2.oi,
        oiChange,
        pctOIChange,
        priceChange: r2.netChangePct,
        buildup,
      });
    }

    return results.sort((a, b) => Math.abs(b.oiChange) - Math.abs(a.oiChange));
  }, [futData, effectiveDate1, effectiveDate2]);

  /* ───── Options OI change ───── */
  const optOiChangeData = useMemo(() => {
    const o1 = optData.find((d) => d.date === effectiveDate1);
    const o2 = optData.find((d) => d.date === effectiveDate2);
    if (!o1 || !o2) return [];

    const nearExp1 = getNearMonthExpiry(o1.records);
    const nearExp2 = getNearMonthExpiry(o2.records);

    function aggregateOptions(records, expiry) {
      const filtered = expiry ? records.filter((r) => r.expiry === expiry) : records;
      const map = {};
      for (const r of filtered) {
        if (!map[r.symbol]) {
          map[r.symbol] = { symbol: r.symbol, segment: r.segment, callOI: 0, putOI: 0, totalOI: 0, callVol: 0, putVol: 0 };
        }
        const m = map[r.symbol];
        if (r.optionType === 'CE') { m.callOI += r.oi; m.callVol += r.volume; }
        else { m.putOI += r.oi; m.putVol += r.volume; }
        m.totalOI += r.oi;
      }
      return map;
    }

    const map1 = aggregateOptions(o1.records, nearExp1);
    const map2 = aggregateOptions(o2.records, nearExp2);

    const results = [];
    for (const [sym, r2] of Object.entries(map2)) {
      const r1 = map1[sym];
      if (!r1) continue;

      const oiChange = r2.totalOI - r1.totalOI;
      const pctOIChange = r1.totalOI ? ((r2.totalOI - r1.totalOI) / r1.totalOI * 100) : 0;
      const callOIChange = r2.callOI - r1.callOI;
      const putOIChange = r2.putOI - r1.putOI;
      const prevPCR = r1.callOI > 0 ? r1.putOI / r1.callOI : 0;
      const currPCR = r2.callOI > 0 ? r2.putOI / r2.callOI : 0;

      results.push({
        symbol: sym,
        segment: r2.segment,
        prevOI: r1.totalOI,
        currOI: r2.totalOI,
        oiChange,
        pctOIChange,
        prevCallOI: r1.callOI,
        currCallOI: r2.callOI,
        callOIChange,
        prevPutOI: r1.putOI,
        currPutOI: r2.putOI,
        putOIChange,
        prevPCR,
        currPCR,
        pcrChange: currPCR - prevPCR,
      });
    }

    return results.sort((a, b) => Math.abs(b.oiChange) - Math.abs(a.oiChange));
  }, [optData, effectiveDate1, effectiveDate2]);

  // Active comparison data based on toggle
  const activeOiData = bhavView === 'futures' ? futOiChangeData : optOiChangeData;
  const filteredOiData = segFilter === 'All' ? activeOiData : activeOiData.filter((r) => r.segment === segFilter);

  /* ───── OI Change chart ───── */
  const oiChangeChart = useMemo(() => {
    const top = filteredOiData.slice(0, 20);
    if (!top.length) return {};
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
        data: top.map((r) => ({
          value: r.oiChange,
          itemStyle: { color: r.oiChange >= 0 ? '#4caf50' : '#f44336' },
        })).reverse(),
        barMaxWidth: 25,
      }],
    };
  }, [filteredOiData, darkMode]);

  /* ───── Buildup pie chart (futures only) ───── */
  const buildupChart = useMemo(() => {
    if (bhavView !== 'futures' || !filteredOiData.length) return null;
    const counts = {};
    for (const r of filteredOiData) {
      counts[r.buildup.type] = (counts[r.buildup.type] || 0) + 1;
    }
    const COLORS_MAP = {
      'Long Buildup': '#4caf50',
      'Short Buildup': '#f44336',
      'Short Covering': '#ff9800',
      'Long Unwinding': '#9c27b0',
      'Neutral': '#9e9e9e',
    };
    return {
      tooltip: { trigger: 'item' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      series: [{
        type: 'pie',
        radius: ['40%', '75%'],
        data: Object.entries(counts).map(([name, value]) => ({
          name, value, itemStyle: { color: COLORS_MAP[name] || '#888' },
        })),
        label: { color: darkMode ? '#ccc' : '#333' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      }],
    };
  }, [bhavView, filteredOiData, darkMode]);

  /* ───── Options PCR change chart ───── */
  const pcrChangeChart = useMemo(() => {
    if (bhavView !== 'options' || !filteredOiData.length) return null;
    const withPCR = filteredOiData.filter((r) => r.prevPCR > 0 && r.currPCR > 0);
    const top = [...withPCR].sort((a, b) => Math.abs(b.pcrChange) - Math.abs(a.pcrChange)).slice(0, 20);
    if (!top.length) return null;

    return {
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}: ${p[0].value > 0 ? '+' : ''}${p[0].value.toFixed(3)}` },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        name: 'PCR Change',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: top.map((r) => r.symbol).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: top.map((r) => ({
          value: parseFloat(r.pcrChange.toFixed(3)),
          itemStyle: { color: r.pcrChange >= 0 ? '#4caf50' : '#f44336' },
        })).reverse(),
        barMaxWidth: 25,
      }],
    };
  }, [bhavView, filteredOiData, darkMode]);

  // Insights
  const compInsights = useMemo(() => generateComparisonInsights(pPrev, pCurr), [pPrev, pCurr]);

  if (allDates.length < 2) {
    return (
      <Alert severity="info">
        Upload at least two files of the same type (different dates) to compare. Currently {allDates.length} date(s) available.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Date selectors */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Previous Date</InputLabel>
          <Select value={effectiveDate1} label="Previous Date" onChange={(e) => setDate1(e.target.value)}>
            {allDates.map((d) => <MenuItem key={d} value={d}>{formatDate(d)}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="body1" sx={{ mx: 1 }}>vs</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Current Date</InputLabel>
          <Select value={effectiveDate2} label="Current Date" onChange={(e) => setDate2(e.target.value)}>
            {allDates.map((d) => <MenuItem key={d} value={d}>{formatDate(d)}</MenuItem>)}
          </Select>
        </FormControl>
        <ToggleButtonGroup size="small" exclusive value={bhavView} onChange={(_, v) => v && setBhavView(v)}>
          <ToggleButton value="futures">Futures</ToggleButton>
          <ToggleButton value="options">Options</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Segment</InputLabel>
          <Select value={segFilter} label="Segment" onChange={(e) => setSegFilter(e.target.value)}>
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Index">Index</MenuItem>
            <MenuItem value="Stock">Stock</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Insights */}
      {compInsights.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {compInsights.map((ins, i) => (
            <Alert key={i} severity={ins.sentiment === 'bullish' ? 'success' : ins.sentiment === 'bearish' ? 'error' : 'warning'} sx={{ mb: 1 }}>
              {ins.text}
            </Alert>
          ))}
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Participant position change */}
        {participantChangeChart && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Participant Net Position Change</Typography>
                <ReactECharts option={participantChangeChart} style={{ height: 400 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Participant detail table */}
        {participantChangeTable.length > 0 && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Position Change Details</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Participant</TableCell>
                        <TableCell align="right">Fut Idx L</TableCell>
                        <TableCell align="right">Fut Idx S</TableCell>
                        <TableCell align="right">Fut Stk L</TableCell>
                        <TableCell align="right">Fut Stk S</TableCell>
                        <TableCell align="right">Total Long</TableCell>
                        <TableCell align="right">Total Short</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {participantChangeTable.map((row) => (
                        <TableRow key={row.clientType}>
                          <TableCell><strong>{row.clientType}</strong></TableCell>
                          {['futIdxL', 'futIdxS', 'futStkL', 'futStkS', 'totalLong', 'totalShort'].map((f) => (
                            <TableCell key={f} align="right" sx={{ color: row[`${f}_change`] >= 0 ? 'success.main' : 'error.main' }}>
                              {row[`${f}_change`] >= 0 ? '+' : ''}{formatNum(row[`${f}_change`])}
                              <Typography variant="caption" display="block" color="text.secondary">
                                ({row[`${f}_pct`] >= 0 ? '+' : ''}{row[`${f}_pct`].toFixed(1)}%)
                              </Typography>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* OI Change chart */}
        {filteredOiData.length > 0 && (
          <>
            <Grid item xs={12} md={buildupChart || pcrChangeChart ? 8 : 12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {bhavView === 'futures' ? 'Futures' : 'Options'} OI Change – Top 20
                    {segFilter !== 'All' && ` (${segFilter})`}
                  </Typography>
                  <ReactECharts option={oiChangeChart} style={{ height: 500 }} />
                </CardContent>
              </Card>
            </Grid>

            {/* Buildup pie (futures) or PCR change (options) */}
            {buildupChart && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Buildup Classification</Typography>
                    <ReactECharts option={buildupChart} style={{ height: 300 }} />
                  </CardContent>
                </Card>
              </Grid>
            )}
            {pcrChangeChart && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>PCR Change by Symbol</Typography>
                    <ReactECharts option={pcrChangeChart} style={{ height: 500 }} />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Data table */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {bhavView === 'futures' ? 'OI Change & Buildup Analysis' : 'Options OI Change & PCR Analysis'}
                    {segFilter !== 'All' && ` – ${segFilter}`}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        {bhavView === 'futures' ? (
                          <TableRow>
                            <TableCell>Symbol</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell align="right">Prev OI</TableCell>
                            <TableCell align="right">Curr OI</TableCell>
                            <TableCell align="right">OI Change</TableCell>
                            <TableCell align="right">OI Change %</TableCell>
                            <TableCell align="right">Price %</TableCell>
                            <TableCell>Buildup</TableCell>
                          </TableRow>
                        ) : (
                          <TableRow>
                            <TableCell>Symbol</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell align="right">Prev Total OI</TableCell>
                            <TableCell align="right">Curr Total OI</TableCell>
                            <TableCell align="right">OI Change</TableCell>
                            <TableCell align="right">OI %</TableCell>
                            <TableCell align="right">Call OI Chg</TableCell>
                            <TableCell align="right">Put OI Chg</TableCell>
                            <TableCell align="right">Prev PCR</TableCell>
                            <TableCell align="right">Curr PCR</TableCell>
                            <TableCell align="right">PCR Chg</TableCell>
                          </TableRow>
                        )}
                      </TableHead>
                      <TableBody>
                        {filteredOiData.slice(0, 100).map((r) =>
                          bhavView === 'futures' ? (
                            <TableRow key={r.symbol} hover>
                              <TableCell><strong>{r.symbol}</strong></TableCell>
                              <TableCell><Chip label={r.segment} size="small" variant="outlined" /></TableCell>
                              <TableCell align="right">{formatNum(r.prevOI)}</TableCell>
                              <TableCell align="right">{formatNum(r.currOI)}</TableCell>
                              <TableCell align="right" sx={{ color: r.oiChange >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                                {r.oiChange >= 0 ? '+' : ''}{formatNum(r.oiChange)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.pctOIChange >= 0 ? 'success.main' : 'error.main' }}>
                                {r.pctOIChange >= 0 ? '+' : ''}{r.pctOIChange.toFixed(1)}%
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.priceChange >= 0 ? 'success.main' : 'error.main' }}>
                                {r.priceChange >= 0 ? '+' : ''}{r.priceChange.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <Chip label={r.buildup.type} size="small"
                                  sx={{ bgcolor: r.buildup.color, color: '#fff', fontWeight: 600 }}
                                />
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={r.symbol} hover>
                              <TableCell><strong>{r.symbol}</strong></TableCell>
                              <TableCell><Chip label={r.segment} size="small" variant="outlined" /></TableCell>
                              <TableCell align="right">{formatNum(r.prevOI)}</TableCell>
                              <TableCell align="right">{formatNum(r.currOI)}</TableCell>
                              <TableCell align="right" sx={{ color: r.oiChange >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                                {r.oiChange >= 0 ? '+' : ''}{formatNum(r.oiChange)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.pctOIChange >= 0 ? 'success.main' : 'error.main' }}>
                                {r.pctOIChange >= 0 ? '+' : ''}{r.pctOIChange.toFixed(1)}%
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.callOIChange >= 0 ? 'success.main' : 'error.main' }}>
                                {r.callOIChange >= 0 ? '+' : ''}{formatNum(r.callOIChange)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.putOIChange >= 0 ? 'success.main' : 'error.main' }}>
                                {r.putOIChange >= 0 ? '+' : ''}{formatNum(r.putOIChange)}
                              </TableCell>
                              <TableCell align="right">{r.prevPCR.toFixed(2)}</TableCell>
                              <TableCell align="right">{r.currPCR.toFixed(2)}</TableCell>
                              <TableCell align="right" sx={{ color: r.pcrChange >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                                {r.pcrChange >= 0 ? '+' : ''}{r.pcrChange.toFixed(3)}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {filteredOiData.length === 0 && (futOiChangeData.length > 0 || optOiChangeData.length > 0) && (
          <Grid item xs={12}>
            <Alert severity="info">
              No {bhavView} data found for the selected dates and segment filter. Try changing the segment or date selection.
            </Alert>
          </Grid>
        )}

        {futOiChangeData.length === 0 && optOiChangeData.length === 0 && !participantChangeChart && (
          <Grid item xs={12}>
            <Alert severity="info">
              Upload at least two files of the same type (different dates) to see bhavcopy comparison.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
