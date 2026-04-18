import { useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';
import {
  formatNum, buildMultiDayTrend, calculateFIILongShortRatio, calculatePCR,
} from '../utils/insights';

const PART_COLORS = { Client: '#42a5f5', DII: '#ff7043', FII: '#ab47bc', Pro: '#26a69a' };

export default function MultiDayTrend() {
  const { participantData, bhavcopyData, darkMode } = useData();

  const trendData = useMemo(() => buildMultiDayTrend(participantData), [participantData]);
  const fiiRatioData = useMemo(() => calculateFIILongShortRatio(participantData), [participantData]);
  const dates = trendData.map((d) => formatDate(d.date));
  const participants = ['Client', 'DII', 'FII', 'Pro'];

  // PCR trend across days
  const pcrTrend = useMemo(() => {
    const optData = bhavcopyData.filter((d) => d.type === 'options').sort((a, b) => a.date.localeCompare(b.date));
    return optData.map((d) => {
      const pcr = calculatePCR(d.records);
      return { date: d.date, oiPCR: pcr.oiPCR, volumePCR: pcr.volumePCR };
    });
  }, [bhavcopyData]);

  /* ───── Net Futures Position Trend ───── */
  const futNetChart = useMemo(() => {
    if (!trendData.length) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: participants, textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: participants.map((p) => ({
        name: p,
        type: 'line',
        data: trendData.map((d) => d[`${p}_futNet`] || 0),
        lineStyle: { width: 2.5, color: PART_COLORS[p] },
        itemStyle: { color: PART_COLORS[p] },
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
      })),
    };
  }, [trendData, dates, darkMode]);

  /* ───── Net Options Position Trend ───── */
  const optNetChart = useMemo(() => {
    if (!trendData.length) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: participants, textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: participants.map((p) => ({
        name: p,
        type: 'line',
        data: trendData.map((d) => d[`${p}_optNet`] || 0),
        lineStyle: { width: 2.5, color: PART_COLORS[p] },
        itemStyle: { color: PART_COLORS[p] },
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
      })),
    };
  }, [trendData, dates, darkMode]);

  /* ───── FII Index L/S Ratio Trend ───── */
  const fiiRatioChart = useMemo(() => {
    if (!fiiRatioData.length) return {};
    const validData = fiiRatioData.filter((d) => d.ratio !== null);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const d = validData[params[0].dataIndex];
          return `<b>${formatDate(d.date)}</b><br/>
            L/S Ratio: <b>${d.ratio.toFixed(2)}</b><br/>
            Long: ${formatNum(d.longContracts)}<br/>
            Short: ${formatNum(d.shortContracts)}`;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 60, right: 30, top: 30, bottom: 30 },
      xAxis: {
        type: 'category',
        data: validData.map((d) => formatDate(d.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [{
        type: 'line',
        data: validData.map((d) => d.ratio?.toFixed(3)),
        smooth: true,
        lineStyle: { width: 3, color: '#ab47bc' },
        areaStyle: { opacity: 0.1, color: '#ab47bc' },
        itemStyle: {
          color: (params) => Number(params.value) >= 1 ? '#4caf50' : '#f44336',
        },
        symbol: 'circle',
        symbolSize: 8,
        markLine: {
          symbol: 'none',
          data: [{ yAxis: 1, lineStyle: { color: '#fff', type: 'dashed' }, label: { formatter: 'L/S = 1', color: '#ccc' } }],
        },
      }],
    };
  }, [fiiRatioData, darkMode]);

  /* ───── FII Index Long & Short stacked area ───── */
  const fiiLongShortChart = useMemo(() => {
    if (!trendData.length) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['FII Idx Long', 'FII Idx Short'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 } },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'FII Idx Long',
          type: 'line',
          data: trendData.map((d) => d.FII_futIdxL || 0),
          areaStyle: { opacity: 0.2, color: '#4caf50' },
          lineStyle: { width: 2, color: '#4caf50' },
          itemStyle: { color: '#4caf50' },
          smooth: true,
        },
        {
          name: 'FII Idx Short',
          type: 'line',
          data: trendData.map((d) => d.FII_futIdxS || 0),
          areaStyle: { opacity: 0.2, color: '#f44336' },
          lineStyle: { width: 2, color: '#f44336' },
          itemStyle: { color: '#f44336' },
          smooth: true,
        },
      ],
    };
  }, [trendData, dates, darkMode]);

  /* ───── PCR Trend ───── */
  const pcrTrendChart = useMemo(() => {
    if (!pcrTrend.length) return {};
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const d = pcrTrend[params[0].dataIndex];
          return `<b>${formatDate(d.date)}</b><br/>OI PCR: ${d.oiPCR.toFixed(2)}<br/>Vol PCR: ${d.volumePCR.toFixed(2)}`;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      legend: { data: ['OI PCR', 'Volume PCR'], textStyle: { color: darkMode ? '#ccc' : '#333' } },
      grid: { left: 60, right: 30, top: 50, bottom: 30 },
      xAxis: {
        type: 'category',
        data: pcrTrend.map((d) => formatDate(d.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'OI PCR',
          type: 'line',
          data: pcrTrend.map((d) => d.oiPCR.toFixed(3)),
          lineStyle: { width: 2.5, color: '#7c4dff' },
          itemStyle: { color: (p) => Number(p.value) > 1 ? '#4caf50' : '#f44336' },
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          markLine: {
            symbol: 'none',
            data: [{ yAxis: 1, lineStyle: { color: '#fff', type: 'dashed' }, label: { formatter: 'PCR=1', color: '#ccc' } }],
          },
        },
        {
          name: 'Volume PCR',
          type: 'line',
          data: pcrTrend.map((d) => d.volumePCR.toFixed(3)),
          lineStyle: { width: 2, color: '#ff9800', type: 'dashed' },
          itemStyle: { color: '#ff9800' },
          smooth: true,
          symbol: 'diamond',
          symbolSize: 6,
        },
      ],
    };
  }, [pcrTrend, darkMode]);

  if (participantData.length < 2 && pcrTrend.length < 2) {
    return (
      <Alert severity="info">
        Upload data for at least 2 different dates to view multi-day trends. Currently {participantData.length} participant date(s) available.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        📈 Multi-Day Trend Tracker
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track participant positions, FII L/S ratio, and PCR evolution across {Math.max(participantData.length, pcrTrend.length)} trading days
      </Typography>

      <Grid container spacing={3}>
        {/* FII Index L/S Ratio */}
        {fiiRatioData.filter((d) => d.ratio !== null).length >= 2 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>FII Index Futures Long/Short Ratio</Typography>
                <ReactECharts option={fiiRatioChart} style={{ height: 380 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* FII Long & Short absolute */}
        {trendData.length >= 2 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>FII Index Futures — Long vs Short</Typography>
                <ReactECharts option={fiiLongShortChart} style={{ height: 380 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* PCR Trend */}
        {pcrTrend.length >= 2 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>PCR Trend</Typography>
                <ReactECharts option={pcrTrendChart} style={{ height: 380 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Net Futures Position Trend */}
        {trendData.length >= 2 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Net Futures Position Trend</Typography>
                <ReactECharts option={futNetChart} style={{ height: 380 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Net Options Position Trend */}
        {trendData.length >= 2 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Net Options Position Trend</Typography>
                <ReactECharts option={optNetChart} style={{ height: 380 }} />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
