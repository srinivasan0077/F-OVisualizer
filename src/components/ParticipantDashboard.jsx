import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Alert, Chip,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/parsers';
import { formatNum } from '../utils/insights';

const SEGMENTS = [
  {
    key: 'indexFutures', label: 'Index Futures',
    cols: [{ long: 'futIdxL', short: 'futIdxS' }],
  },
  {
    key: 'stockFutures', label: 'Stock Futures',
    cols: [{ long: 'futStkL', short: 'futStkS' }],
  },
  {
    key: 'indexOptions', label: 'Index Options',
    cols: [
      { long: 'optIdxCL', short: 'optIdxCS', label: 'Call' },
      { long: 'optIdxPL', short: 'optIdxPS', label: 'Put' },
    ],
  },
  {
    key: 'stockOptions', label: 'Stock Options',
    cols: [
      { long: 'optStkCL', short: 'optStkCS', label: 'Call' },
      { long: 'optStkPL', short: 'optStkPS', label: 'Put' },
    ],
  },
];

const COLORS = {
  Client: '#42a5f5', DII: '#ff7043', FII: '#ab47bc', Pro: '#26a69a',
};

export default function ParticipantDashboard() {
  const { participantData, darkMode } = useData();
  const [selectedDate, setSelectedDate] = useState('');
  const [segment, setSegment] = useState('indexFutures');

  const data = useMemo(() => {
    if (!participantData.length) return null;
    const d = selectedDate || participantData[participantData.length - 1]?.date;
    return participantData.find((p) => p.date === d) || participantData[participantData.length - 1];
  }, [participantData, selectedDate]);

  const segDef = SEGMENTS.find((s) => s.key === segment);

  /* ───── Chart options ───── */
  const chartOptions = useMemo(() => {
    if (!data || !segDef) return {};
    const participants = data.participants;
    const categories = participants.map((p) => p.clientType);
    const isOptions = segDef.cols.length > 1;

    const series = [];
    if (isOptions) {
      for (const col of segDef.cols) {
        series.push({
          name: `${col.label} Long`,
          type: 'bar',
          data: participants.map((p) => p[col.long]),
          itemStyle: { color: col.label === 'Call' ? '#42a5f5' : '#66bb6a' },
        });
        series.push({
          name: `${col.label} Short`,
          type: 'bar',
          data: participants.map((p) => p[col.short]),
          itemStyle: { color: col.label === 'Call' ? '#ef5350' : '#ffa726' },
        });
      }
    } else {
      series.push({
        name: 'Long',
        type: 'bar',
        data: participants.map((p) => p[segDef.cols[0].long]),
        itemStyle: { color: '#4caf50' },
        barMaxWidth: 60,
      });
      series.push({
        name: 'Short',
        type: 'bar',
        data: participants.map((p) => p[segDef.cols[0].short]),
        itemStyle: { color: '#f44336' },
        barMaxWidth: 60,
      });
    }

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: {
        feature: { saveAsImage: { title: 'Save' } },
        right: 10,
      },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: categories, axisLabel: { color: darkMode ? '#ccc' : '#333' } },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: darkMode ? '#ccc' : '#333',
          formatter: (v) => formatNum(v),
        },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series,
    };
  }, [data, segDef, darkMode]);

  /* ───── Net position chart ───── */
  const netChartOptions = useMemo(() => {
    if (!data) return {};
    const parts = data.participants;
    const categories = parts.map((p) => p.clientType);

    const netFut = parts.map((p) => (p.futIdxL + p.futStkL) - (p.futIdxS + p.futStkS));
    const netOpt = parts.map((p) =>
      (p.optIdxCL + p.optIdxPL + p.optStkCL + p.optStkPL) -
      (p.optIdxCS + p.optIdxPS + p.optStkCS + p.optStkPS),
    );

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: 30, top: 50, bottom: 30 },
      xAxis: { type: 'category', data: categories, axisLabel: { color: darkMode ? '#ccc' : '#333' } },
      yAxis: {
        type: 'value',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => formatNum(v) },
        splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
      },
      series: [
        {
          name: 'Net Futures',
          type: 'bar',
          data: netFut.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#4caf50' : '#f44336' } })),
          barMaxWidth: 50,
        },
        {
          name: 'Net Options',
          type: 'bar',
          data: netOpt.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#66bb6a' : '#ef5350' } })),
          barMaxWidth: 50,
        },
      ],
    };
  }, [data, darkMode]);

  if (!participantData.length) {
    return <Alert severity="info">Upload a Participant-wise Open Interest CSV to view this dashboard.</Alert>;
  }

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
        {participantData.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Date</InputLabel>
            <Select value={selectedDate || data?.date || ''} label="Date" onChange={(e) => setSelectedDate(e.target.value)}>
              {participantData.map((d) => (
                <MenuItem key={d.date} value={d.date}>{formatDate(d.date)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={segment}
          onChange={(_, v) => v && setSegment(v)}
          sx={{ flexWrap: 'wrap' }}
        >
          {SEGMENTS.map((s) => (
            <ToggleButton key={s.key} value={s.key}>{s.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        {data && (
          <Chip label={formatDate(data.date)} color="primary" variant="outlined" />
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Segment chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{segDef?.label} – Long vs Short</Typography>
              <ReactECharts option={chartOptions} style={{ height: 400 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Net position chart */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Net Positions</Typography>
              <ReactECharts option={netChartOptions} style={{ height: 400 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Summary table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Detailed Breakdown</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Participant</TableCell>
                      <TableCell align="right">Fut Idx Long</TableCell>
                      <TableCell align="right">Fut Idx Short</TableCell>
                      <TableCell align="right">Fut Stk Long</TableCell>
                      <TableCell align="right">Fut Stk Short</TableCell>
                      <TableCell align="right">Opt Idx CL</TableCell>
                      <TableCell align="right">Opt Idx PL</TableCell>
                      <TableCell align="right">Opt Idx CS</TableCell>
                      <TableCell align="right">Opt Idx PS</TableCell>
                      <TableCell align="right">Total Long</TableCell>
                      <TableCell align="right">Total Short</TableCell>
                      <TableCell align="right">Net</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.participants.map((p) => {
                      const net = p.totalLong - p.totalShort;
                      return (
                        <TableRow key={p.clientType}>
                          <TableCell>
                            <Chip label={p.clientType} size="small"
                              sx={{ bgcolor: COLORS[p.clientType] || '#888', color: '#fff', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right">{formatNum(p.futIdxL)}</TableCell>
                          <TableCell align="right">{formatNum(p.futIdxS)}</TableCell>
                          <TableCell align="right">{formatNum(p.futStkL)}</TableCell>
                          <TableCell align="right">{formatNum(p.futStkS)}</TableCell>
                          <TableCell align="right">{formatNum(p.optIdxCL)}</TableCell>
                          <TableCell align="right">{formatNum(p.optIdxPL)}</TableCell>
                          <TableCell align="right">{formatNum(p.optIdxCS)}</TableCell>
                          <TableCell align="right">{formatNum(p.optIdxPS)}</TableCell>
                          <TableCell align="right"><strong>{formatNum(p.totalLong)}</strong></TableCell>
                          <TableCell align="right"><strong>{formatNum(p.totalShort)}</strong></TableCell>
                          <TableCell align="right" sx={{ color: net >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                            {net >= 0 ? '+' : ''}{formatNum(net)}
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
    </Box>
  );
}
