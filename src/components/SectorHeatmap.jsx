import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { aggregateBySymbol, getNearMonthExpiry, formatDate } from '../utils/parsers';
import { formatNum } from '../utils/insights';
import { groupBySector, getSectorColor } from '../utils/sectors';

export default function SectorHeatmap() {
  const { bhavcopyData, darkMode } = useData();
  const [metric, setMetric] = useState('oi');

  const latestFutures = useMemo(
    () => bhavcopyData.filter((d) => d.type === 'futures').slice(-1)[0] || null,
    [bhavcopyData],
  );

  const sectorData = useMemo(() => {
    if (!latestFutures) return [];
    const nearExpiry = getNearMonthExpiry(latestFutures.records);
    const agg = aggregateBySymbol(latestFutures.records.filter((r) => r.segment === 'Stock'), nearExpiry);
    return groupBySector(agg);
  }, [latestFutures]);

  /* ───── Treemap ───── */
  const treemapOption = useMemo(() => {
    if (!sectorData.length) return {};
    const field = metric === 'oi' ? 'totalOI' : 'totalVolume';
    const data = sectorData
      .filter((s) => s.sector !== 'Index' && s[field] > 0)
      .map((s) => ({
        name: s.sector,
        value: s[field],
        itemStyle: { color: getSectorColor(s.sector), borderColor: darkMode ? '#1a1a2e' : '#fff', borderWidth: 2 },
        children: s.symbols
          .sort((a, b) => (b[metric === 'oi' ? 'oi' : 'volume'] || 0) - (a[metric === 'oi' ? 'oi' : 'volume'] || 0))
          .slice(0, 15)
          .map((sym) => ({
            name: sym.symbol,
            value: sym[metric === 'oi' ? 'oi' : 'volume'] || 0,
          })),
      }));

    return {
      tooltip: {
        formatter: (p) => {
          if (p.treePathInfo?.length > 2) {
            return `<b>${p.name}</b> (${p.treePathInfo[1]?.name})<br/>${metric === 'oi' ? 'OI' : 'Volume'}: ${formatNum(p.value)}`;
          }
          return `<b>${p.name}</b><br/>Total ${metric === 'oi' ? 'OI' : 'Volume'}: ${formatNum(p.value)}<br/>Stocks: ${sectorData.find((s) => s.sector === p.name)?.count || 0}`;
        },
      },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      series: [{
        type: 'treemap',
        data,
        roam: false,
        leafDepth: 2,
        visibleMin: 300,
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 12,
          color: '#fff',
          textShadowColor: '#000',
          textShadowBlur: 3,
        },
        upperLabel: {
          show: true,
          height: 24,
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          backgroundColor: 'transparent',
        },
        breadcrumb: {
          show: true,
          itemStyle: { color: darkMode ? '#333' : '#e0e0e0', textStyle: { color: darkMode ? '#ccc' : '#333' } },
        },
        levels: [
          {
            itemStyle: { borderColor: darkMode ? '#1a1a2e' : '#fff', borderWidth: 3, gapWidth: 3 },
          },
          {
            colorSaturation: [0.3, 0.7],
            itemStyle: { borderColor: darkMode ? '#222' : '#eee', borderWidth: 1, gapWidth: 1 },
          },
        ],
      }],
    };
  }, [sectorData, metric, darkMode]);

  /* ───── Bar chart by sector ───── */
  const sectorBarChart = useMemo(() => {
    if (!sectorData.length) return {};
    const filtered = sectorData.filter((s) => s.sector !== 'Index');
    const field = metric === 'oi' ? 'totalOI' : 'totalVolume';
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
        data: filtered.map((s) => s.sector).reverse(),
        axisLabel: { color: darkMode ? '#ccc' : '#333' },
      },
      series: [{
        type: 'bar',
        data: filtered.map((s) => ({
          value: s[field],
          itemStyle: { color: getSectorColor(s.sector) },
        })).reverse(),
        barMaxWidth: 30,
      }],
    };
  }, [sectorData, metric, darkMode]);

  /* ───── Sector pie ───── */
  const sectorPieChart = useMemo(() => {
    if (!sectorData.length) return {};
    const filtered = sectorData.filter((s) => s.sector !== 'Index' && s.sector !== 'Other');
    const field = metric === 'oi' ? 'totalOI' : 'totalVolume';
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      series: [{
        type: 'pie',
        radius: ['40%', '75%'],
        data: filtered.map((s) => ({
          name: s.sector,
          value: s[field],
          itemStyle: { color: getSectorColor(s.sector) },
        })),
        label: { color: darkMode ? '#ccc' : '#333', fontSize: 11 },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      }],
    };
  }, [sectorData, metric, darkMode]);

  if (!latestFutures) {
    return <Alert severity="info">Upload Futures Bhavcopy data to view sector analysis.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          🗺️ Sector Heatmap
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, v) => v && setMetric(v)}>
          <ToggleButton value="oi">By OI</ToggleButton>
          <ToggleButton value="volume">By Volume</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Sector-wise breakdown of F&O activity — {formatDate(latestFutures.date)}
      </Typography>

      <Grid container spacing={3}>
        {/* Treemap */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sector Treemap — {metric === 'oi' ? 'Open Interest' : 'Volume'}
              </Typography>
              <ReactECharts option={treemapOption} style={{ height: 500 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Bar chart */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sector Ranking</Typography>
              <ReactECharts option={sectorBarChart} style={{ height: 400 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Pie chart */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sector Distribution</Typography>
              <ReactECharts option={sectorPieChart} style={{ height: 400 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
