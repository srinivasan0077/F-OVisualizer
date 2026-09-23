import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogContent, DialogTitle,
  Divider, FormControlLabel, FormGroup, Grid, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';
import { buildFIIIndexFuturesTrend, calculateMovingAverage, formatNum } from '../utils/insights';

const LOOKBACKS = [
  { value: '5', label: '5D' },
  { value: '10', label: '10D' },
  { value: '20', label: '20D' },
  { value: 'all', label: 'All' },
];

const MA_OPTIONS = ['3', '5', '10', '20'];

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createZoomConfig(length) {
  const endValue = Math.max(0, length - 1);
  const startValue = Math.max(0, length - 20);
  return [
    {
      type: 'inside',
      xAxisIndex: 0,
      startValue,
      endValue,
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
    },
    {
      type: 'slider',
      xAxisIndex: 0,
      startValue,
      endValue,
      bottom: 5,
      height: 20,
    },
  ];
}

function buildTrendlineSeries(lines, baseLength) {
  return lines.map((line, index) => {
    const points = new Array(baseLength).fill(null);
    points[line.start.index] = line.start.value;
    points[line.end.index] = line.end.value;
    return {
      name: `Trendline ${index + 1}`,
      type: 'line',
      data: points,
      connectNulls: true,
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5, color: '#ffca28' },
      itemStyle: { color: '#ffca28' },
      tooltip: { show: false },
      z: 20,
    };
  });
}

export default function FIIIndexFuturesExplorer() {
  const { participantData, darkMode } = useData();
  const [open, setOpen] = useState(false);
  const [lookback, setLookback] = useState('10');
  const [studyTarget, setStudyTarget] = useState('ratio');
  const [studyPeriods, setStudyPeriods] = useState(['3', '5']);
  const [drawMode, setDrawMode] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [trendlines, setTrendlines] = useState({ study: [], longShort: [] });

  const trendData = useMemo(() => buildFIIIndexFuturesTrend(participantData), [participantData]);

  const visibleTrend = useMemo(() => {
    if (lookback === 'all') return trendData;
    return trendData.slice(-Number(lookback));
  }, [lookback, trendData]);

  const latest = visibleTrend[visibleTrend.length - 1] || null;
  const validRatios = visibleTrend.filter((row) => row.ratio !== null);
  const xDates = visibleTrend.map((row) => formatDate(row.date));

  const summary = useMemo(() => {
    if (!visibleTrend.length) return null;
    const last = visibleTrend[visibleTrend.length - 1];
    const first = visibleTrend[0];
    return {
      currentRegime: last.regime,
      ratioChange: last.ratio !== null && first.ratio !== null ? last.ratio - first.ratio : null,
      netChange: last.netContracts - first.netContracts,
      avgRatio: average(validRatios.map((row) => row.ratio)),
      avgPressure: average(visibleTrend.map((row) => row.pressurePct)),
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

  const studyConfig = useMemo(() => {
    if (studyTarget === 'contracts') {
      return {
        label: 'Contracts',
        yAxisName: 'Contracts',
        series: [
          {
            key: 'long',
            label: 'Long Contracts',
            values: visibleTrend.map((row) => row.longContracts),
            color: '#43a047',
          },
          {
            key: 'short',
            label: 'Short Contracts',
            values: visibleTrend.map((row) => row.shortContracts),
            color: '#e53935',
          },
        ],
      };
    }

    return {
      label: 'L/S Ratio',
      yAxisName: 'Ratio',
      series: [
        {
          key: 'ratio',
          label: 'L/S Ratio',
          values: visibleTrend.map((row) => row.ratio),
          color: '#8e24aa',
        },
      ],
    };
  }, [studyTarget, visibleTrend]);

  const studyAnalysis = useMemo(() => {
    if (!studyConfig) return null;
    return {
      maSeries: studyConfig.series.flatMap((baseSeries) => studyPeriods.map((period, index) => ({
        key: `${baseSeries.key}_${period}`,
        label: `${baseSeries.label} MA${period}`,
        period: Number(period),
        values: calculateMovingAverage(baseSeries.values, Number(period)),
        baseKey: baseSeries.key,
        color: ['#ffa726', '#29b6f6', '#7cb342', '#26c6da'][index % 4],
      }))),
    };
  }, [studyConfig, studyPeriods]);

  const studySignals = useMemo(() => {
    if (!studyConfig || !studyAnalysis) return [];
    const lines = [];

    for (const baseSeries of studyConfig.series) {
      const latestValue = baseSeries.values[baseSeries.values.length - 1];
      const relatedMas = studyAnalysis.maSeries.filter((series) => series.baseKey === baseSeries.key);

      for (const ma of relatedMas) {
        const latestMA = ma.values[ma.values.length - 1];
        if (latestValue == null || latestMA == null) continue;
        lines.push(
          `${baseSeries.label} is ${latestValue >= latestMA ? 'above' : 'below'} MA${ma.period} `
          + `(${studyTarget === 'ratio' ? latestMA.toFixed(2) : formatNum(latestMA)}).`,
        );
      }
    }

    return lines;
  }, [studyAnalysis, studyConfig, studyTarget]);

  const zoomConfig = useMemo(() => createZoomConfig(visibleTrend.length), [visibleTrend.length]);

  const handleChartClick = (chartKey) => (params) => {
    if (drawMode !== chartKey || params?.componentType !== 'series' || typeof params.dataIndex !== 'number') return;

    const rawValue = Array.isArray(params.value) ? params.value[1] : params.value;
    if (rawValue == null) return;

    const point = {
      index: params.dataIndex,
      value: Number(rawValue),
      date: visibleTrend[params.dataIndex]?.date,
    };

    if (!pendingPoint) {
      setPendingPoint({ chartKey, point });
      return;
    }

    if (pendingPoint.chartKey !== chartKey) {
      setPendingPoint({ chartKey, point });
      return;
    }

    if (pendingPoint.point.index === point.index && pendingPoint.point.value === point.value) return;

    const ordered = pendingPoint.point.index <= point.index
      ? { start: pendingPoint.point, end: point }
      : { start: point, end: pendingPoint.point };

    setTrendlines((current) => ({
      ...current,
      [chartKey]: [...current[chartKey], ordered],
    }));
    setPendingPoint(null);
    setDrawMode(null);
  };

  const clearTrendlines = (chartKey) => {
    setTrendlines((current) => ({ ...current, [chartKey]: [] }));
    if (drawMode === chartKey) setDrawMode(null);
    if (pendingPoint?.chartKey === chartKey) setPendingPoint(null);
  };

  const longShortChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['FII Index Long', 'FII Index Short'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    dataZoom: zoomConfig,
    grid: { left: 80, right: 30, top: 50, bottom: 70 },
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
      ...buildTrendlineSeries(trendlines.longShort, visibleTrend.length),
    ],
  }), [darkMode, visibleTrend, xDates, zoomConfig, trendlines.longShort]);

  const ratioNetChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['L/S Ratio', 'Net Position'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    dataZoom: zoomConfig,
    grid: { left: 70, right: 80, top: 50, bottom: 70 },
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
  }), [darkMode, visibleTrend, xDates, zoomConfig]);

  const changeChart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['Long Change', 'Short Change', 'Net Change'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
    toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
    dataZoom: zoomConfig,
    grid: { left: 70, right: 30, top: 50, bottom: 70 },
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
  }), [darkMode, visibleTrend, xDates, zoomConfig]);

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
    if (!studyConfig || !studyAnalysis) return {};

    return {
      tooltip: { trigger: 'axis' },
      legend: {
        data: [
          ...studyConfig.series.map((series) => series.label),
          ...studyAnalysis.maSeries.map((series) => series.label),
        ],
        textStyle: { color: darkMode ? '#ccc' : '#333' },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      dataZoom: zoomConfig,
      grid: { left: 70, right: 30, top: 55, bottom: 70 },
      xAxis: { type: 'category', data: xDates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: {
        type: 'value',
        name: studyConfig.yAxisName,
        axisLabel: {
          color: darkMode ? '#ccc' : '#333',
          formatter: (value) => (studyTarget === 'ratio' ? value.toFixed(2) : formatNum(value)),
        },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        ...studyConfig.series.map((series) => ({
          name: series.label,
          type: 'line',
          data: series.values,
          smooth: true,
          lineStyle: { width: 3, color: series.color },
          itemStyle: { color: series.color },
          areaStyle: { opacity: 0.06, color: series.color },
        })),
        ...studyAnalysis.maSeries.map((series) => ({
          name: series.label,
          type: 'line',
          data: series.values,
          smooth: true,
          connectNulls: true,
          lineStyle: { width: 2, color: series.color, type: 'dashed' },
          itemStyle: { color: series.color },
          symbol: 'none',
        })),
        ...buildTrendlineSeries(trendlines.study, visibleTrend.length),
      ],
    };
  }, [darkMode, studyAnalysis, studyConfig, studyTarget, xDates, zoomConfig, trendlines.study, visibleTrend.length]);

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
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={studyTarget}
                  onChange={(_, value) => {
                    if (!value) return;
                    setStudyTarget(value);
                    clearTrendlines('study');
                  }}
                >
                  <ToggleButton value="ratio">Ratio</ToggleButton>
                  <ToggleButton value="contracts">Contracts</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={lookback}
                  onChange={(_, value) => {
                    if (!value) return;
                    setLookback(value);
                    setPendingPoint(null);
                    setDrawMode(null);
                    setTrendlines({ study: [], longShort: [] });
                  }}
                >
                  {LOOKBACKS.map((option) => (
                    <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Moving averages
              </Typography>
              <FormGroup row>
                {MA_OPTIONS.map((period) => (
                  <FormControlLabel
                    key={period}
                    control={(
                      <Checkbox
                        checked={studyPeriods.includes(period)}
                        onChange={(e) => {
                          setStudyPeriods((current) => {
                            if (e.target.checked) return [...current, period].sort((a, b) => Number(a) - Number(b));
                            if (current.length === 1) return current;
                            return current.filter((value) => value !== period);
                          });
                        }}
                      />
                    )}
                    label={`MA${period}`}
                  />
                ))}
              </FormGroup>
            </Box>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Chart Navigation & Trendlines</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Use mouse wheel or trackpad to zoom, drag inside the chart to pan, or use the bottom slider for a rolling history window.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <Button
                    variant={drawMode === 'study' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setDrawMode(drawMode === 'study' ? null : 'study');
                      setPendingPoint(null);
                    }}
                  >
                    {drawMode === 'study' ? 'Cancel Study Trendline' : 'Draw on Study Chart'}
                  </Button>
                  <Button
                    variant={drawMode === 'longShort' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setDrawMode(drawMode === 'longShort' ? null : 'longShort');
                      setPendingPoint(null);
                    }}
                  >
                    {drawMode === 'longShort' ? 'Cancel Long/Short Trendline' : 'Draw on Long/Short Chart'}
                  </Button>
                  <Button variant="text" color="warning" onClick={() => clearTrendlines('study')}>
                    Clear Study Trendlines
                  </Button>
                  <Button variant="text" color="warning" onClick={() => clearTrendlines('longShort')}>
                    Clear Long/Short Trendlines
                  </Button>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">1. Enable draw mode for a chart.</Typography>
                  <Typography variant="body2">2. Click the first point, then the second point on that chart.</Typography>
                  <Typography variant="body2">3. The line remains while the explorer stays open.</Typography>
                  <Typography variant="caption" color="text.secondary">Trendlines are currently two-click annotations, not draggable objects.</Typography>
                  {pendingPoint && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      First point selected on {pendingPoint.chartKey === 'study' ? 'Study Chart' : 'Long/Short Chart'} for {formatDate(pendingPoint.point.date)}. Click the second point to finish the trendline.
                    </Alert>
                  )}
                </Box>
              </CardContent>
            </Card>

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

            {studyAnalysis && studyConfig && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Trend Studies</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Selected Series</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{studyConfig.label}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    {studyTarget === 'ratio' ? (
                      <Grid item xs={12} md={3}>
                        <Card variant="outlined">
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Latest Ratio</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{latest?.ratio?.toFixed(2) || '-'}</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ) : (
                      <>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent sx={{ textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">Latest Long</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>{formatNum(latest?.longContracts || 0)}</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent sx={{ textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">Latest Short</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>{formatNum(latest?.shortContracts || 0)}</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </>
                    )}
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Active MAs</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{studyPeriods.map((period) => `MA${period}`).join(', ')}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                  <ReactECharts option={studyChart} style={{ height: 360 }} onEvents={{ click: handleChartClick('study') }} />
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
                    <ReactECharts option={longShortChart} style={{ height: 360 }} onEvents={{ click: handleChartClick('longShort') }} />
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