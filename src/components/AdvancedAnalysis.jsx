import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Chip, Autocomplete, TextField,
  FormControl, InputLabel, Select, MenuItem, ToggleButtonGroup, ToggleButton,
  Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { getNearMonthExpiry, getSymbols, getExpiries, formatDate } from '../utils/parsers';
import {
  formatNum, calculateCOI, calculateStraddleZones, calculateIVSmile, calculateRollover,
} from '../utils/insights';

export default function AdvancedAnalysis() {
  const { bhavcopyData, darkMode } = useData();
  const [view, setView] = useState('coi');
  const [symbolFilter, setSymbolFilter] = useState(null);
  const [expiryFilter, setExpiryFilter] = useState('');

  const optionsDates = useMemo(() =>
    bhavcopyData.filter((d) => d.type === 'options').sort((a, b) => a.date.localeCompare(b.date)),
    [bhavcopyData],
  );
  const futuresDates = useMemo(() =>
    bhavcopyData.filter((d) => d.type === 'futures').sort((a, b) => a.date.localeCompare(b.date)),
    [bhavcopyData],
  );

  const latestOpt = optionsDates[optionsDates.length - 1] || null;
  const prevOpt = optionsDates.length >= 2 ? optionsDates[optionsDates.length - 2] : null;
  const latestFut = futuresDates[futuresDates.length - 1] || null;

  const symbols = useMemo(() => latestOpt ? getSymbols(latestOpt.records) : [], [latestOpt]);
  const expiries = useMemo(() => latestOpt ? getExpiries(latestOpt.records) : [], [latestOpt]);
  const nearExpiry = useMemo(() => latestOpt ? getNearMonthExpiry(latestOpt.records) : '', [latestOpt]);
  const activeExpiry = expiryFilter || nearExpiry;
  const activeSymbol = symbolFilter || 'NIFTY';

  /* ═══════ COI Analysis ═══════ */
  const coiData = useMemo(() => {
    if (!prevOpt || !latestOpt) return null;
    return calculateCOI(prevOpt.records, latestOpt.records, activeSymbol, activeExpiry);
  }, [prevOpt, latestOpt, activeSymbol, activeExpiry]);

  const coiChart = useMemo(() => {
    if (!coiData?.focused?.length) return {};
    const strikes = coiData.focused;
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const s = params[0].axisValue;
          let tip = `<b>Strike: ${Number(s).toLocaleString('en-IN')}</b>`;
          for (const p of params) tip += `<br/>${p.seriesName}: ${formatNum(p.value)}`;
          return tip;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      legend: { data: ['Call COI', 'Put COI'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 80, right: 30, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: strikes.map((s) => s.strike),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45, formatter: (v) => Number(v).toLocaleString('en-IN') },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'Call COI',
          type: 'bar',
          data: strikes.map((s) => ({
            value: s.callCOI,
            itemStyle: { color: s.callCOI > 0 ? '#ef5350' : '#66bb6a' },
          })),
          barMaxWidth: 18,
        },
        {
          name: 'Put COI',
          type: 'bar',
          data: strikes.map((s) => ({
            value: s.putCOI,
            itemStyle: { color: s.putCOI > 0 ? '#4caf50' : '#f44336' },
          })),
          barMaxWidth: 18,
        },
      ],
    };
  }, [coiData, darkMode]);

  /* COI Heatmap */
  const coiHeatmapOption = useMemo(() => {
    if (!coiData?.focused?.length) return {};
    const strikes = coiData.focused;
    const labels = ['Call COI', 'Put COI'];
    const data = [];
    strikes.forEach((s, i) => {
      data.push([i, 0, s.callCOI]);
      data.push([i, 1, s.putCOI]);
    });
    const maxVal = Math.max(...data.map((d) => Math.abs(d[2])), 1);
    return {
      tooltip: {
        formatter: (p) => `Strike: ${strikes[p.data[0]]?.strike?.toLocaleString('en-IN')}<br/>${labels[p.data[1]]}: ${formatNum(p.data[2])}`,
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 50, top: 10, bottom: 60 },
      xAxis: {
        type: 'category',
        data: strikes.map((s) => s.strike),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45, formatter: (v) => Number(v).toLocaleString('en-IN') },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      visualMap: {
        min: -maxVal,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#f44336', '#ffeb3b', '#4caf50'] },
        textStyle: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'heatmap',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    };
  }, [coiData, darkMode]);

  /* ═══════ Straddle/Strangle Zones ═══════ */
  const straddleData = useMemo(() => {
    if (!latestOpt) return null;
    return calculateStraddleZones(latestOpt.records, activeSymbol, activeExpiry);
  }, [latestOpt, activeSymbol, activeExpiry]);

  /* ═══════ IV Smile ═══════ */
  const ivData = useMemo(() => {
    if (!latestOpt) return null;
    return calculateIVSmile(latestOpt.records, activeSymbol, activeExpiry);
  }, [latestOpt, activeSymbol, activeExpiry]);

  const ivSmileChart = useMemo(() => {
    if (!ivData?.focused?.length) return {};
    const strikes = ivData.focused.filter((s) => s.callIV || s.putIV);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const s = strikes[params[0].dataIndex];
          let tip = `<b>Strike: ${s?.strike?.toLocaleString('en-IN')}</b>`;
          for (const p of params) tip += `<br/>${p.seriesName}: ${Number(p.value).toFixed(1)}%`;
          return tip;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      legend: { data: ['Call IV', 'Put IV'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 60, right: 30, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: strikes.map((s) => s.strike),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45, formatter: (v) => Number(v).toLocaleString('en-IN') },
      },
      yAxis: {
        type: 'value',
        name: 'IV %',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => `${v}%` },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'Call IV',
          type: 'line',
          data: strikes.map((s) => s.callIV?.toFixed(1) || null),
          smooth: true,
          lineStyle: { width: 2.5, color: '#ef5350' },
          itemStyle: { color: '#ef5350' },
          connectNulls: true,
        },
        {
          name: 'Put IV',
          type: 'line',
          data: strikes.map((s) => s.putIV?.toFixed(1) || null),
          smooth: true,
          lineStyle: { width: 2.5, color: '#66bb6a' },
          itemStyle: { color: '#66bb6a' },
          connectNulls: true,
        },
      ],
    };
  }, [ivData, darkMode]);

  /* ═══════ Rollover Analysis ═══════ */
  const rolloverData = useMemo(() => {
    if (!latestFut) return [];
    return calculateRollover(latestFut.records);
  }, [latestFut]);

  const rolloverChart = useMemo(() => {
    if (!rolloverData.length) return {};
    const stocks = rolloverData.filter((r) => r.segment === 'Stock').slice(0, 20);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const r = stocks[stocks.length - 1 - params[0].dataIndex];
          return `<b>${r?.symbol}</b><br/>Rollover: ${r?.rolloverPct.toFixed(1)}%<br/>
            Near OI: ${formatNum(r?.nearOI)}<br/>Next OI: ${formatNum(r?.nextOI)}<br/>
            Cost: ${r?.rolloverCost.toFixed(2)} (${r?.rolloverCostPct.toFixed(2)}%)`;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
      xAxis: {
        type: 'value',
        name: 'Rollover %',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => `${v}%` },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      yAxis: {
        type: 'category',
        data: stocks.map((r) => r.symbol).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: stocks.map((r) => ({
          value: r.rolloverPct.toFixed(1),
          itemStyle: { color: r.rolloverPct > 50 ? '#4caf50' : r.rolloverPct > 30 ? '#ff9800' : '#f44336' },
        })).reverse(),
        barMaxWidth: 25,
      }],
    };
  }, [rolloverData, darkMode]);

  if (!bhavcopyData.length) {
    return <Alert severity="info">Upload F&amp;O Bhavcopy files to view advanced analysis.</Alert>;
  }

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="coi">Change in OI</ToggleButton>
          <ToggleButton value="straddle">Straddle Zones</ToggleButton>
          <ToggleButton value="iv">IV Smile</ToggleButton>
          <ToggleButton value="rollover">Rollover</ToggleButton>
        </ToggleButtonGroup>

        {view !== 'rollover' && (
          <>
            <Autocomplete
              size="small"
              options={symbols}
              value={activeSymbol}
              onChange={(_, v) => setSymbolFilter(v)}
              renderInput={(params) => <TextField {...params} label="Symbol" />}
              sx={{ minWidth: 180 }}
              disableClearable
            />
            {expiries.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Expiry</InputLabel>
                <Select value={activeExpiry} label="Expiry" onChange={(e) => setExpiryFilter(e.target.value)}>
                  {expiries.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </>
        )}
      </Box>

      {/* ═══ Change in OI ═══ */}
      {view === 'coi' && (
        <>
          {!prevOpt ? (
            <Alert severity="info">Upload Options Bhavcopy for at least 2 dates to see Change in OI analysis.</Alert>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Change in OI — {activeSymbol}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                        {formatDate(prevOpt.date)} → {formatDate(latestOpt.date)}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      🟢 Positive COI = fresh writing (new positions) | 🔴 Negative COI = unwinding
                    </Typography>
                    {coiData?.focused?.length ? (
                      <ReactECharts option={coiChart} style={{ height: 420 }} />
                    ) : (
                      <Alert severity="warning">No data available for {activeSymbol}</Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              {coiData?.focused?.length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>COI Heatmap — {activeSymbol}</Typography>
                      <ReactECharts option={coiHeatmapOption} style={{ height: 200 }} />
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </>
      )}

      {/* ═══ Straddle/Strangle Zones ═══ */}
      {view === 'straddle' && (
        <Grid container spacing={3}>
          {straddleData ? (
            <>
              <Grid item xs={12}>
                <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      OI-Implied Range — {activeSymbol}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Support (Max Put OI)</Typography>
                        <Typography variant="h5" fontWeight={700} color="success.main">
                          {straddleData.lowerBound.toLocaleString('en-IN')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">OI: {formatNum(straddleData.maxPutOI)}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Resistance (Max Call OI)</Typography>
                        <Typography variant="h5" fontWeight={700} color="error.main">
                          {straddleData.upperBound.toLocaleString('en-IN')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">OI: {formatNum(straddleData.maxCallOI)}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Range Width</Typography>
                        <Typography variant="h5" fontWeight={700}>
                          {straddleData.rangeWidth.toLocaleString('en-IN')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">({straddleData.rangeWidthPct.toFixed(1)}%)</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Underlying</Typography>
                        <Typography variant="h5" fontWeight={700} color="info.main">
                          {straddleData.underlyingValue > 0 ? straddleData.underlyingValue.toLocaleString('en-IN') : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">ATM: {straddleData.atmStrike?.toLocaleString('en-IN')}</Typography>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      💡 <strong>Trading Implication:</strong> Market is expected to stay within {straddleData.lowerBound.toLocaleString('en-IN')} — {straddleData.upperBound.toLocaleString('en-IN')} based on OI concentration.
                      {straddleData.rangeWidthPct < 3 && ' Narrow range suggests low volatility expected — favor straddle/strangle sells.'}
                      {straddleData.rangeWidthPct > 5 && ' Wide range suggests high volatility expected — favor directional or straddle buys.'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          ) : (
            <Grid item xs={12}>
              <Alert severity="warning">No options data available for {activeSymbol}</Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* ═══ IV Smile ═══ */}
      {view === 'iv' && (
        <Grid container spacing={3}>
          {ivData?.focused?.length ? (
            <>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>IV Smile / Skew — {activeSymbol}</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Chip label={`Median IV: ${ivData.medianIV?.toFixed(1)}%`} color="primary" variant="outlined" />
                      {ivData.highIVStrikes.length > 0 && (
                        <Chip label={`${ivData.highIVStrikes.length} abnormally high IV strikes`} color="warning" variant="outlined" />
                      )}
                    </Box>
                    <ReactECharts option={ivSmileChart} style={{ height: 400 }} />
                  </CardContent>
                </Card>
              </Grid>
              {ivData.highIVStrikes.length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>⚠️ Abnormally High IV Strikes</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Strikes with IV &gt; 1.5× median — potential event plays, traps, or mispriced options
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Strike</TableCell>
                              <TableCell align="right">Call IV</TableCell>
                              <TableCell align="right">Put IV</TableCell>
                              <TableCell align="right">Avg IV</TableCell>
                              <TableCell align="right">Moneyness</TableCell>
                              <TableCell align="right">Call OI</TableCell>
                              <TableCell align="right">Put OI</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {ivData.highIVStrikes.map((s) => (
                              <TableRow key={s.strike} hover>
                                <TableCell><strong>{s.strike.toLocaleString('en-IN')}</strong></TableCell>
                                <TableCell align="right">{s.callIV?.toFixed(1) || '-'}%</TableCell>
                                <TableCell align="right">{s.putIV?.toFixed(1) || '-'}%</TableCell>
                                <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 700 }}>{s.avgIV?.toFixed(1)}%</TableCell>
                                <TableCell align="right">{s.moneyness.toFixed(1)}%</TableCell>
                                <TableCell align="right">{formatNum(s.callOI)}</TableCell>
                                <TableCell align="right">{formatNum(s.putOI)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </>
          ) : (
            <Grid item xs={12}>
              <Alert severity="warning">No IV data available for {activeSymbol}. Make sure options bhavcopy is uploaded.</Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* ═══ Rollover Analysis ═══ */}
      {view === 'rollover' && (
        <Grid container spacing={3}>
          {rolloverData.length > 0 ? (
            <>
              {/* Index rollover cards */}
              {rolloverData.filter((r) => r.segment === 'Index').map((r) => (
                <Grid item xs={12} sm={6} md={3} key={r.symbol}>
                  <Card sx={{ border: '1px solid', borderColor: r.rolloverPct > 50 ? 'success.main' : 'warning.main' }}>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">{r.symbol} Rollover</Typography>
                      <Typography variant="h4" fontWeight={700} sx={{ color: r.rolloverPct > 50 ? 'success.main' : 'warning.main' }}>
                        {r.rolloverPct.toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Cost: {r.rolloverCost.toFixed(2)} ({r.rolloverCostPct.toFixed(2)}%)
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {r.nearExpiry} → {r.nextExpiry}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Stock Rollover %</Typography>
                    <ReactECharts option={rolloverChart} style={{ height: 500 }} />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Rollover Details</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Symbol</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell align="right">Near OI</TableCell>
                            <TableCell align="right">Next OI</TableCell>
                            <TableCell align="right">Rollover %</TableCell>
                            <TableCell align="right">Near Price</TableCell>
                            <TableCell align="right">Next Price</TableCell>
                            <TableCell align="right">Cost</TableCell>
                            <TableCell align="right">Cost %</TableCell>
                            <TableCell>Signal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rolloverData.map((r) => (
                            <TableRow key={r.symbol} hover>
                              <TableCell><strong>{r.symbol}</strong></TableCell>
                              <TableCell><Chip label={r.segment} size="small" variant="outlined" /></TableCell>
                              <TableCell align="right">{formatNum(r.nearOI)}</TableCell>
                              <TableCell align="right">{formatNum(r.nextOI)}</TableCell>
                              <TableCell align="right" sx={{
                                color: r.rolloverPct > 50 ? 'success.main' : r.rolloverPct > 30 ? 'warning.main' : 'error.main',
                                fontWeight: 700,
                              }}>
                                {r.rolloverPct.toFixed(1)}%
                              </TableCell>
                              <TableCell align="right">{r.nearPrice.toFixed(2)}</TableCell>
                              <TableCell align="right">{r.nextPrice.toFixed(2)}</TableCell>
                              <TableCell align="right" sx={{ color: r.rolloverCost >= 0 ? 'success.main' : 'error.main' }}>
                                {r.rolloverCost.toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: r.rolloverCostPct >= 0 ? 'success.main' : 'error.main' }}>
                                {r.rolloverCostPct.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={
                                    r.rolloverPct > 50 && r.rolloverCost > 0 ? 'Bullish Continuation'
                                      : r.rolloverPct > 50 && r.rolloverCost < 0 ? 'Cautious Continuation'
                                      : r.rolloverPct < 30 ? 'Weak / Exhaustion'
                                      : 'Neutral'
                                  }
                                  color={
                                    r.rolloverPct > 50 && r.rolloverCost > 0 ? 'success'
                                      : r.rolloverPct < 30 ? 'error'
                                      : 'warning'
                                  }
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </>
          ) : (
            <Grid item xs={12}>
              <Alert severity="info">
                Rollover analysis requires futures data with at least 2 expiry months present. Upload near-expiry bhavcopy data.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
