import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Chip, Divider,
  ToggleButtonGroup, ToggleButton, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TableSortLabel,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { analyzeStrikes, formatNum } from '../utils/insights';

const SENTIMENT_MAP = {
  bullish: { color: 'success', icon: '📈' },
  bearish: { color: 'error', icon: '📉' },
  info: { color: 'info', icon: '📊' },
};

export default function StrikeAnalysis({ records, symbol, expiry, darkMode }) {
  const [oiView, setOiView] = useState('focused'); // focused or all
  const [sortField, setSortField] = useState('strike');
  const [sortDir, setSortDir] = useState('asc');

  const analysis = useMemo(
    () => analyzeStrikes(records, symbol, expiry),
    [records, symbol, expiry],
  );

  const {
    strikes = [], focusedStrikes = [], maxPain = null, painValues = [],
    supports = [], resistances = [], immSupport = null, immResistance = null,
    underlyingValue = 0, atmStrike = null, insights = [],
  } = analysis || {};

  const displayStrikes = oiView === 'focused' ? focusedStrikes : strikes;

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  /* ───── OI Distribution by Strike (Call vs Put) ───── */
  const oiDistChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const strike = params[0].axisValue;
          let tip = `<b>Strike: ${Number(strike).toLocaleString('en-IN')}</b>`;
          for (const p of params) {
            tip += `<br/>${p.seriesName}: ${formatNum(Math.abs(p.value))}`;
          }
          return tip;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      legend: { data: ['Call OI', 'Put OI'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 80, right: 30, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: displayStrikes.map((s) => s.strike),
        axisLabel: {
          color: darkMode ? '#ccc' : '#333',
          rotate: 45,
          formatter: (v) => Number(v).toLocaleString('en-IN'),
        },
        axisLine: { lineStyle: { color: darkMode ? '#555' : '#ccc' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(Math.abs(v)) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'Call OI',
          type: 'bar',
          stack: 'oi',
          data: displayStrikes.map((s) => ({
            value: -s.callOI,
            itemStyle: {
              color: s.strike === atmStrike ? '#e53935' : s.strike === maxPain ? '#ff8a80' : '#ef5350',
              opacity: s.strike === atmStrike || s.strike === maxPain ? 1 : 0.75,
            },
          })),
          barMaxWidth: 20,
        },
        {
          name: 'Put OI',
          type: 'bar',
          stack: 'oi',
          data: displayStrikes.map((s) => ({
            value: s.putOI,
            itemStyle: {
              color: s.strike === atmStrike ? '#2e7d32' : s.strike === maxPain ? '#a5d6a7' : '#66bb6a',
              opacity: s.strike === atmStrike || s.strike === maxPain ? 1 : 0.75,
            },
          })),
          barMaxWidth: 20,
        },
      ],
      // Mark lines for ATM and max pain
      ...(underlyingValue || maxPain ? {} : {}),
    };
  }, [displayStrikes, darkMode, atmStrike, maxPain, underlyingValue]);

  /* ──── Mark lines overlay (separate series for visual markers) ──── */
  const oiDistWithMarks = useMemo(() => {
    const chart = { ...oiDistChart };
    const markLines = [];
    if (atmStrike) {
      const idx = displayStrikes.findIndex((s) => s.strike === atmStrike);
      if (idx >= 0) markLines.push({ xAxis: idx, label: { formatter: 'ATM', color: '#fff' }, lineStyle: { color: '#ffb74d', type: 'dashed', width: 2 } });
    }
    if (maxPain) {
      const idx = displayStrikes.findIndex((s) => s.strike === maxPain);
      if (idx >= 0) markLines.push({ xAxis: idx, label: { formatter: 'Max Pain', color: '#fff' }, lineStyle: { color: '#ce93d8', type: 'dashed', width: 2 } });
    }
    if (markLines.length && chart.series?.[0]) {
      chart.series[0] = { ...chart.series[0], markLine: { symbol: 'none', data: markLines } };
    }
    return chart;
  }, [oiDistChart, atmStrike, maxPain, displayStrikes]);

  /* ───── PCR by Strike ───── */
  const pcrByStrikeChart = useMemo(() => {
    const pcrStrikes = displayStrikes.filter((s) => s.pcr !== null);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const strike = params[0].axisValue;
          return `<b>Strike: ${Number(strike).toLocaleString('en-IN')}</b><br/>PCR: ${params[0]?.value?.toFixed(2) || '-'}`;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 60 },
      xAxis: {
        type: 'category',
        data: pcrStrikes.map((s) => s.strike),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45, formatter: (v) => Number(v).toLocaleString('en-IN') },
        axisLine: { lineStyle: { color: darkMode ? '#555' : '#ccc' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line',
        data: pcrStrikes.map((s) => s.pcr?.toFixed(2)),
        smooth: true,
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2.5, color: '#7c4dff' },
        itemStyle: {
          color: (params) => {
            const val = Number(params.value);
            return val > 1 ? '#4caf50' : val < 0.7 ? '#f44336' : '#ff9800';
          },
        },
        markLine: {
          symbol: 'none',
          data: [{ yAxis: 1, lineStyle: { color: '#fff', type: 'dashed' }, label: { formatter: 'PCR=1', color: '#ccc' } }],
        },
      }],
    };
  }, [displayStrikes, darkMode]);

  /* ───── Volume by Strike ───── */
  const volByStrikeChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const strike = params[0].axisValue;
          let tip = `<b>Strike: ${Number(strike).toLocaleString('en-IN')}</b>`;
          for (const p of params) tip += `<br/>${p.seriesName}: ${formatNum(p.value)}`;
          return tip;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      legend: { data: ['Call Volume', 'Put Volume'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 80, right: 30, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: displayStrikes.map((s) => s.strike),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 45, formatter: (v) => Number(v).toLocaleString('en-IN') },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        { name: 'Call Volume', type: 'bar', data: displayStrikes.map((s) => s.callVol), itemStyle: { color: '#ef5350' }, barMaxWidth: 16 },
        { name: 'Put Volume', type: 'bar', data: displayStrikes.map((s) => s.putVol), itemStyle: { color: '#66bb6a' }, barMaxWidth: 16 },
      ],
    };
  }, [displayStrikes, darkMode]);

  /* ───── Sorted table data ───── */
  const sortedStrikes = useMemo(() => {
    return [...displayStrikes].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * ((a[sortField] ?? 0) - (b[sortField] ?? 0));
    });
  }, [displayStrikes, sortField, sortDir]);

  if (!analysis || !strikes.length) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        Strike Analysis — {symbol}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {expiry && `Expiry: ${expiry} | `}
        {underlyingValue > 0 && `Underlying: ${underlyingValue.toLocaleString('en-IN')} | `}
        ATM Strike: {atmStrike?.toLocaleString('en-IN')}
      </Typography>

      {/* Key levels cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ border: '1px solid', borderColor: 'info.main' }}>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Max Pain</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                {maxPain?.toLocaleString('en-IN') || '-'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {immSupport && (
          <Grid item xs={6} sm={3}>
            <Card sx={{ border: '1px solid', borderColor: 'success.main' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Immediate Support</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {immSupport.strike.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary">Put OI: {formatNum(immSupport.oi)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {immResistance && (
          <Grid item xs={6} sm={3}>
            <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Immediate Resistance</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {immResistance.strike.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary">Call OI: {formatNum(immResistance.oi)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Underlying</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {underlyingValue > 0 ? underlyingValue.toLocaleString('en-IN') : '-'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Support & Resistance levels with strength bars */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="success.main" gutterBottom>
                🟢 Support Levels (High Put OI)
              </Typography>
              {supports.map((s, i) => (
                <Box key={s.strike} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {s.strike.toLocaleString('en-IN')}
                      {i === 0 && <Chip label="Strongest" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{formatNum(s.oi)}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={s.strength * 100}
                    color="success"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="error.main" gutterBottom>
                🔴 Resistance Levels (High Call OI)
              </Typography>
              {resistances.map((s, i) => (
                <Box key={s.strike} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {s.strike.toLocaleString('en-IN')}
                      {i === 0 && <Chip label="Strongest" size="small" color="error" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{formatNum(s.oi)}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={s.strength * 100}
                    color="error"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Insights */}
      {insights.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Strike-Level Insights</Typography>
            <Divider sx={{ mb: 2 }} />
            {insights.map((ins, i) => {
              const meta = SENTIMENT_MAP[ins.sentiment] || SENTIMENT_MAP.info;
              return (
                <Alert key={i} severity={meta.color} sx={{ mb: 1 }} icon={false}>
                  <Typography variant="body2">{meta.icon} {ins.text}</Typography>
                </Alert>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* View toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <ToggleButtonGroup size="small" exclusive value={oiView} onChange={(_, v) => v && setOiView(v)}>
          <ToggleButton value="focused">Near ATM (±15)</ToggleButton>
          <ToggleButton value="all">All Strikes</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>OI Distribution by Strike (Call ↓ | Put ↑)</Typography>
              <ReactECharts option={oiDistWithMarks} style={{ height: 420 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>PCR by Strike</Typography>
              <ReactECharts option={pcrByStrikeChart} style={{ height: 350 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Volume by Strike</Typography>
              <ReactECharts option={volByStrikeChart} style={{ height: 350 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Strike data table */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Strike-wise Data ({displayStrikes.length} strikes)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel active={sortField === 'strike'} direction={sortDir} onClick={() => handleSort('strike')}>Strike</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={sortField === 'callOI'} direction={sortDir} onClick={() => handleSort('callOI')}>Call OI</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={sortField === 'putOI'} direction={sortDir} onClick={() => handleSort('putOI')}>Put OI</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={sortField === 'totalOI'} direction={sortDir} onClick={() => handleSort('totalOI')}>Total OI</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">PCR</TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={sortField === 'callVol'} direction={sortDir} onClick={() => handleSort('callVol')}>Call Vol</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={sortField === 'putVol'} direction={sortDir} onClick={() => handleSort('putVol')}>Put Vol</TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Call LTP</TableCell>
                  <TableCell align="right">Put LTP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedStrikes.map((s) => {
                  const isATM = s.strike === atmStrike;
                  const isMaxPain = s.strike === maxPain;
                  const isSupport = supports.some((sp) => sp.strike === s.strike);
                  const isResistance = resistances.some((sp) => sp.strike === s.strike);
                  return (
                    <TableRow
                      key={s.strike}
                      hover
                      sx={{
                        ...(isATM && { bgcolor: 'rgba(255,183,77,0.12)' }),
                        ...(isMaxPain && !isATM && { bgcolor: 'rgba(206,147,216,0.12)' }),
                      }}
                    >
                      <TableCell>
                        <strong>{s.strike.toLocaleString('en-IN')}</strong>
                        {isATM && <Chip label="ATM" size="small" sx={{ ml: 0.5, height: 18, fontSize: 10, bgcolor: '#ffb74d', color: '#000' }} />}
                        {isMaxPain && <Chip label="MP" size="small" sx={{ ml: 0.5, height: 18, fontSize: 10, bgcolor: '#ce93d8', color: '#000' }} />}
                        {isSupport && <Chip label="S" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                        {isResistance && <Chip label="R" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{formatNum(s.callOI)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{formatNum(s.putOI)}</TableCell>
                      <TableCell align="right"><strong>{formatNum(s.totalOI)}</strong></TableCell>
                      <TableCell align="right" sx={{
                        fontWeight: 600,
                        color: s.pcr != null ? (s.pcr > 1 ? 'success.main' : s.pcr < 0.7 ? 'error.main' : 'warning.main') : 'text.secondary',
                      }}>
                        {s.pcr != null ? s.pcr.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="right">{formatNum(s.callVol)}</TableCell>
                      <TableCell align="right">{formatNum(s.putVol)}</TableCell>
                      <TableCell align="right">{s.callClose > 0 ? s.callClose.toFixed(2) : '-'}</TableCell>
                      <TableCell align="right">{s.putClose > 0 ? s.putClose.toFixed(2) : '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
