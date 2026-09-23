import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle,
  Divider, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Typography, Paper,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';
import {
  buildFIIIndexFuturesTrend, calculateMovingAverage, calculateRegressionTrendline, formatNum,
} from '../utils/insights';

const LOOKBACKS = [
  { value: '5', label: '5D' },
  { value: '10', label: '10D' },
  { value: '20', label: '20D' },
  { value: 'all', label: 'All' },
];

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function FIIIndexFuturesExplorer() {
  const { participantData, darkMode } = useData();
  const [open, setOpen] = useState(false);
  const [lookback, setLookback] = useState('10');
  const [studyTarget, setStudyTarget] = useState('ratio');
  const [studyPeriods, setStudyPeriods] = useState(['3', '5']);

  const trendData = useMemo(() => buildFIIIndexFuturesTrend(participantData), [participantData]);

  const visibleTrend = useMemo(() => {
    if (lookback === 'all') return trendData;
    const count = Number(lookback);
    return trendData.slice(-count);
  }, [trendData, lookback]);

  const latest = visibleTrend[visibleTrend.length - 1] || null;
  const validRatios = visibleTrend.filter((row) => row.ratio !== null);

  const summary = useMemo(() => {
    if (!visibleTrend.length) return null;
    const last = visibleTrend[visibleTrend.length - 1];
    const first = visibleTrend[0];
    const avgRatio = average(validRatios.map((row) => row.ratio));
    const avgPressure = average(visibleTrend.map((row) => row.pressurePct));
    const strongestLong = [...visibleTrend].sort((a, b) => b.longContracts - a.longContracts)[0];
    const strongestShort = [...visibleTrend].sort((a, b) => b.shortContracts - a.shortContracts)[0];
    return {
      currentRegime: last.regime,
      ratioChange: last.ratio !== null && first.ratio !== null ? last.ratio - first.ratio : null,
      netChange: last.netContracts - first.netContracts,
      avgRatio,
      avgPressure,
      strongestLong,
      strongestShort,
      days: visibleTrend.length,
    };
  }, [validRatios, visibleTrend]);

  const insightLines = useMemo(() => {
    if (!summary || !latest) return [];
    const lines = [];
    lines.push(`Current regime: ${summary.currentRegime} with net ${latest.netContracts >= 0 ? 'long' : 'short'} ${formatNum(Math.abs(latest.netContracts))}.`);
    if (latest.ratio !== null) {
      lines.push(`Latest FII index L/S ratio is ${latest.ratio.toFixed(2)} and average over the selected window is ${summary.avgRatio.toFixed(2)}.`);
    }
    if (summary.ratioChange !== null && Math.abs(summary.ratioChange) >= 0.08) {
      lines.push(`Ratio moved ${summary.ratioChange > 0 ? 'up' : 'down'} by ${Math.abs(summary.ratioChange).toFixed(2)} over the selected lookback.`);
    }
    if (Math.abs(summary.netChange) >= 10000) {
      lines.push(`Net index-futures positioning changed by ${formatNum(summary.netChange)} across the selected window.`);
    }
    if (Math.abs(summary.avgPressure) >= 8) {
      lines.push(`Average positioning pressure is ${summary.avgPressure.toFixed(1)}%, showing ${summary.avgPressure > 0 ? 'persistent long-side' : 'persistent short-side'} control.`);
    }
    return lines;
  }, [latest, summary]);

  const xDates = visibleTrend.map((row) => formatDate(row.date));

  const studyTargetConfig = useMemo(() => {
    const config = {
      ratio: {
        label: 'L/S Ratio',
        values: visibleTrend.map((row) => row.ratio),
        formatter: (value) => value?.toFixed(2) || '-',
        yAxisName: 'Ratio',
        bullish: latest?.ratio !== null && latest.ratio >= 1,
      },
      net: {
        label: 'Net Position',
        values: visibleTrend.map((row) => row.netContracts),
        formatter: (value) => formatNum(value || 0),
        yAxisName: 'Contracts',
        bullish: (latest?.netContracts || 0) >= 0,
      },
      long: {
        label: 'Long Contracts',
        values: visibleTrend.map((row) => row.longContracts),
        formatter: (value) => formatNum(value || 0),
        yAxisName: 'Contracts',
        bullish: true,
      },
      short: {
        label: 'Short Contracts',
        values: visibleTrend.map((row) => row.shortContracts),
        formatter: (value) => formatNum(value || 0),
        yAxisName: 'Contracts',
        bullish: false,
      },
    };
    return config[studyTarget];
  }, [latest, studyTarget, visibleTrend]);

  const studyAnalysis = useMemo(() => {
    if (!studyTargetConfig) return null;
    const trendline = calculateRegressionTrendline(studyTargetConfig.values);
    const maSeries = studyPeriods.map((period) => {
      const numericPeriod = Number(period);
      return {
        period: numericPeriod,
        values: calculateMovingAverage(studyTargetConfig.values, numericPeriod),
      };
    });
    const latestValue = studyTargetConfig.values[studyTargetConfig.values.length - 1] ?? null;
    const latestTrendline = trendline.values[trendline.values.length - 1] ?? null;
    const comparisons = maSeries.map((series) => ({
      period: series.period,
      latest: series.values[series.values.length - 1] ?? null,
    }));
    return {
      trendline,
      maSeries,
      latestValue,
      latestTrendline,
      comparisons,
    };
  }, [studyPeriods, studyTargetConfig]);

  const studySignals = useMemo(() => {
    if (!studyAnalysis || !studyTargetConfig) return [];
    const lines = [];
    if (studyAnalysis.latestValue !== null && studyAnalysis.latestTrendline !== null) {
      const delta = studyAnalysis.latestValue - studyAnalysis.latestTrendline;
      lines.push(`${studyTargetConfig.label} is currently ${delta >= 0 ? 'above' : 'below'} its regression trendline by ${studyTarget === 'ratio' ? Math.abs(delta).toFixed(2) : formatNum(Math.abs(delta))}.`);
    }
    if (studyAnalysis.trendline.slope !== 0) {
      lines.push(`Trend slope is ${studyAnalysis.trendline.slope > 0 ? 'rising' : 'falling'} for ${studyTargetConfig.label.toLowerCase()}, indicating ${studyAnalysis.trendline.slope > 0 ? 'improving' : 'weakening'} participation.`);
    }
    for (const comparison of studyAnalysis.comparisons) {
      if (comparison.latest === null || studyAnalysis.latestValue === null) continue;
      const above = studyAnalysis.latestValue >= comparison.latest;
      lines.push(`Latest ${studyTargetConfig.label.toLowerCase()} is ${above ? 'above' : 'below'} MA${comparison.period} (${studyTarget === 'ratio' ? comparison.latest.toFixed(2) : formatNum(comparison.latest)}).`);
    }
    return lines;
  }, [studyAnalysis, studyTarget, studyTargetConfig]);

  const longShortChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['FII Index Long', 'FII Index Short'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    grid: { left: 80, right: 30, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: xDates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
    yAxis: {
      type: 'value',
      axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (value) => formatNum(value) },
      splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
    },
    series: [
      {
        name: 'FII Index Long',
        type: 'line',
        data: visibleTrend.map((row) => row.longContracts),
        smooth: true,
        lineStyle: { width: 2.5, color: '#43a047' },
        areaStyle: { opacity: 0.12, color: '#43a047' },
        itemStyle: { color: '#43a047' },
      },
      {
        name: 'FII Index Short',
        type: 'line',
        data: visibleTrend.map((row) => row.shortContracts),
        smooth: true,
        lineStyle: { width: 2.5, color: '#e53935' },
        areaStyle: { opacity: 0.12, color: '#e53935' },
        itemStyle: { color: '#e53935' },
      },
    ],
  }), [darkMode, visibleTrend, xDates]);

  const ratioNetChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['L/S Ratio', 'Net Position'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    grid: { left: 70, right: 80, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: xDates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
    yAxis: [
      {
        type: 'value',
        name: 'Ratio',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      {
        type: 'value',
        name: 'Net',
        position: 'right',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (value) => formatNum(value) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'L/S Ratio',
        type: 'line',
        data: visibleTrend.map((row) => row.ratio),
        smooth: true,
        lineStyle: { width: 2.5, color: '#8e24aa' },
        itemStyle: { color: (params) => (Number(params.value) >= 1 ? '#43a047' : '#e53935') },
        markLine: {
          symbol: 'none',
          data: [{ yAxis: 1, lineStyle: { color: '#90a4ae', type: 'dashed' }, label: { formatter: 'L/S = 1' } }],
        },
      },
      {
        name: 'Net Position',
        type: 'bar',
        yAxisIndex: 1,
        data: visibleTrend.map((row) => ({
          value: row.netContracts,
          itemStyle: { color: row.netContracts >= 0 ? '#66bb6a' : '#ef5350' },
        })),
        barMaxWidth: 24,
      },
    ],
  }), [darkMode, visibleTrend, xDates]);

  const changeChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['Long Change', 'Short Change', 'Net Change'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    grid: { left: 70, right: 30, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: xDates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
    yAxis: {
      type: 'value',
      axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (value) => formatNum(value) },
      splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
    },
    series: [
      {
        name: 'Long Change',
        type: 'bar',
        data: visibleTrend.map((row) => ({ value: row.longChange, itemStyle: { color: row.longChange >= 0 ? '#43a047' : '#a5d6a7' } })),
        barMaxWidth: 18,
      },
      {
        name: 'Short Change',
        type: 'bar',
        data: visibleTrend.map((row) => ({ value: row.shortChange, itemStyle: { color: row.shortChange >= 0 ? '#e53935' : '#ef9a9a' } })),
        barMaxWidth: 18,
      },
      {
        name: 'Net Change',
        type: 'line',
        data: visibleTrend.map((row) => row.netChange),
        smooth: true,
        lineStyle: { width: 2.5, color: '#1e88e5' },
        itemStyle: { color: '#1e88e5' },
      },
    ],
  }), [darkMode, visibleTrend, xDates]);

  const regimeMapChart = useMemo(() => ({
    tooltip: {
      formatter: (params) => {
        const row = visibleTrend[params.dataIndex];
        return `<b>${formatDate(row.date)}</b><br/>Ratio: ${row.ratio?.toFixed(2) || '-'}<br/>Pressure: ${row.pressurePct.toFixed(1)}%<br/>Gross: ${formatNum(row.grossContracts)}<br/>Regime: ${row.regime}`;
      },
    },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    grid: { left: 60, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'value',
      name: 'L/S Ratio',
      axisLabel: { color: darkMode ? '#ccc' : '#333' },
      splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
    },
    yAxis: {
      type: 'value',
      name: 'Pressure %',
      axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (value) => `${value}%` },
      splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
    },
    series: [{
      type: 'scatter',
      symbolSize: (value) => Math.max(10, Math.min(40, value[2] / 20000)),
      data: visibleTrend.filter((row) => row.ratio !== null).map((row) => [row.ratio, row.pressurePct, row.grossContracts]),
      itemStyle: {
        color: (params) => params.data[1] >= 0 ? '#43a047' : '#e53935',
        opacity: 0.8,
      },
      emphasis: { scale: true },
      markLine: {
        symbol: 'none',
        data: [
          { xAxis: 1, lineStyle: { color: '#90a4ae', type: 'dashed' }, label: { formatter: 'Ratio = 1' } },
          { yAxis: 0, lineStyle: { color: '#90a4ae', type: 'dashed' }, label: { formatter: 'Pressure = 0%' } },
        ],
      },
    }],
  }), [darkMode, visibleTrend]);

  const studyChart = useMemo(() => {
    if (!studyAnalysis || !studyTargetConfig) return {};
    const palette = ['#ffa726', '#29b6f6', '#8e24aa', '#7cb342'];
    return {
      tooltip: { trigger: 'axis' },
      legend: {
        data: [studyTargetConfig.label, ...studyAnalysis.maSeries.map((series) => `MA${series.period}`), 'Trendline'],
        textStyle: { color: darkMode ? '#ccc' : '#333' },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 70, right: 30, top: 55, bottom: 40 },
      xAxis: { type: 'category', data: xDates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: {
        type: 'value',
        name: studyTargetConfig.yAxisName,
        axisLabel: {
          color: darkMode ? '#ccc' : '#333',
          formatter: (value) => (studyTarget === 'ratio' ? value.toFixed(2) : formatNum(value)),
        },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: studyTargetConfig.label,
          type: 'line',
          data: studyTargetConfig.values,
          smooth: true,
          lineStyle: { width: 3, color: studyTargetConfig.bullish ? '#43a047' : '#e53935' },
          itemStyle: { color: studyTargetConfig.bullish ? '#43a047' : '#e53935' },
          areaStyle: { opacity: 0.08, color: studyTargetConfig.bullish ? '#43a047' : '#e53935' },
        },
        ...studyAnalysis.maSeries.map((series, index) => ({
          name: `MA${series.period}`,
          type: 'line',
          data: series.values,
          smooth: true,
          connectNulls: true,
          lineStyle: { width: 2, color: palette[index % palette.length], type: 'dashed' },
          itemStyle: { color: palette[index % palette.length] },
          symbol: 'none',
        })),
        {
          name: 'Trendline',
          type: 'line',
          data: studyAnalysis.trendline.values,
          smooth: false,
          connectNulls: true,
          lineStyle: { width: 2, color: '#90a4ae', type: 'solid' },
          itemStyle: { color: '#90a4ae' },
          symbol: 'none',
        },
      ],
    };
  }, [darkMode, studyAnalysis, studyTarget, studyTargetConfig, xDates]);

  if (!trendData.length) return null;

  return (
    <>
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" gutterBottom>FII Index Futures Trend Lab</Typography>
              <Typography variant="body2" color="text.secondary">
                Open a focused FII explorer with trend, regime, acceleration, and diagnostics on index-futures positioning.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {latest?.ratio !== null && (
                <Chip label={`L/S ${latest.ratio.toFixed(2)}`} color={latest.ratio >= 1 ? 'success' : 'error'} />
              )}
              <Chip label={`Net ${latest?.netContracts >= 0 ? '+' : ''}${formatNum(latest?.netContracts || 0)}`} color={(latest?.netContracts || 0) >= 0 ? 'success' : 'error'} />
              <Button variant="contained" onClick={() => setOpen(true)} disabled={trendData.length < 2}>
                Open FII Trend Explorer
              </Button>
            </Box>
          </Box>
          {trendData.length < 2 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Upload at least 2 participant dates to unlock multi-day FII trend analysis.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>FII Index Futures Explorer</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Study absolute positioning, directional pressure, momentum, and regime shifts in FII index futures.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <ToggleButtonGroup size="small" exclusive value={studyTarget} onChange={(_, value) => value && setStudyTarget(value)}>
                  <ToggleButton value="ratio">Ratio</ToggleButton>
                  <ToggleButton value="net">Net</ToggleButton>
                  <ToggleButton value="long">Long</ToggleButton>
                  <ToggleButton value="short">Short</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup size="small" value={studyPeriods} onChange={(_, value) => value.length && setStudyPeriods(value)}>
                  <ToggleButton value="3">MA3</ToggleButton>
                  <ToggleButton value="5">MA5</ToggleButton>
                  <ToggleButton value="10">MA10</ToggleButton>
                  <ToggleButton value="20">MA20</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup size="small" exclusive value={lookback} onChange={(_, value) => value && setLookback(value)}>
                  {LOOKBACKS.map((option) => (
                    <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            </Box>

            {summary && latest && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Latest L/S Ratio</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: latest.ratio >= 1 ? 'success.main' : 'error.main' }}>
                        {latest.ratio?.toFixed(2) || '-'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Net Position</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: latest.netContracts >= 0 ? 'success.main' : 'error.main' }}>
                        {latest.netContracts >= 0 ? '+' : ''}{formatNum(latest.netContracts)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Pressure</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: latest.pressurePct >= 0 ? 'success.main' : 'error.main' }}>
                        {latest.pressurePct.toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Current Regime</Typography>
                      <Chip label={summary.currentRegime} color={summary.currentRegime === 'Long Heavy' ? 'success' : summary.currentRegime === 'Short Heavy' ? 'error' : 'warning'} sx={{ mt: 1, fontWeight: 700 }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {insightLines.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Quick Read</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {insightLines.map((line) => (
                    <Typography key={line} variant="body2" sx={{ mb: 1 }}>• {line}</Typography>
                  ))}
                </CardContent>
              </Card>
            )}

            {studyAnalysis && studyTargetConfig && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Trend Studies</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Selected Series</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{studyTargetConfig.label}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Latest Value</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {studyTarget === 'ratio'
                              ? studyAnalysis.latestValue?.toFixed(2) || '-'
                              : formatNum(studyAnalysis.latestValue || 0)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Trend Slope</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: studyAnalysis.trendline.slope >= 0 ? 'success.main' : 'error.main' }}>
                            {studyTarget === 'ratio'
                              ? studyAnalysis.trendline.slope.toFixed(3)
                              : formatNum(Math.round(studyAnalysis.trendline.slope))}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Active MAs</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{studyPeriods.map((period) => `MA${period}`).join(', ')}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                  <ReactECharts option={studyChart} style={{ height: 360 }} />
                  <Box sx={{ mt: 2 }}>
                    {studySignals.map((line) => (
                      <Typography key={line} variant="body2" sx={{ mb: 0.75 }}>• {line}</Typography>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>FII Index Futures - Long vs Short</Typography>
                    <ReactECharts option={longShortChart} style={{ height: 360 }} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Ratio and Net Position</Typography>
                    <ReactECharts option={ratioNetChart} style={{ height: 360 }} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Day-over-Day Position Change</Typography>
                    <ReactECharts option={changeChart} style={{ height: 360 }} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Regime Map</Typography>
                    <ReactECharts option={regimeMapChart} style={{ height: 360 }} />
                    <Typography variant="caption" color="text.secondary">
                      Bubble size = gross exposure. Top-right means long-heavy and positive pressure; bottom-left means short-heavy and negative pressure.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Diagnostics Table</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Long</TableCell>
                            <TableCell align="right">Short</TableCell>
                            <TableCell align="right">Net</TableCell>
                            <TableCell align="right">Gross</TableCell>
                            <TableCell align="right">L/S Ratio</TableCell>
                            <TableCell align="right">Pressure %</TableCell>
                            <TableCell align="right">Long d/d</TableCell>
                            <TableCell align="right">Short d/d</TableCell>
                            <TableCell align="right">Net d/d</TableCell>
                            <TableCell align="right">Regime</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleTrend.map((row) => (
                            <TableRow key={row.date} hover>
                              <TableCell>{formatDate(row.date)}</TableCell>
                              <TableCell align="right">{formatNum(row.longContracts)}</TableCell>
                              <TableCell align="right">{formatNum(row.shortContracts)}</TableCell>
                              <TableCell align="right" sx={{ color: row.netContracts >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                                {row.netContracts >= 0 ? '+' : ''}{formatNum(row.netContracts)}
                              </TableCell>
                              <TableCell align="right">{formatNum(row.grossContracts)}</TableCell>
                              <TableCell align="right">{row.ratio?.toFixed(2) || '-'}</TableCell>
                              <TableCell align="right">{row.pressurePct.toFixed(1)}%</TableCell>
                              <TableCell align="right">{row.longChange >= 0 ? '+' : ''}{formatNum(row.longChange)}</TableCell>
                              <TableCell align="right">{row.shortChange >= 0 ? '+' : ''}{formatNum(row.shortChange)}</TableCell>
                              <TableCell align="right">{row.netChange >= 0 ? '+' : ''}{formatNum(row.netChange)}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={row.regime}
                                  size="small"
                                  color={row.regime === 'Long Heavy' ? 'success' : row.regime === 'Short Heavy' ? 'error' : 'warning'}
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
            </Grid>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}