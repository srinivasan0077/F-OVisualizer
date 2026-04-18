import { useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Alert, Chip, Divider,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { formatDate, getNearMonthExpiry } from '../utils/parsers';
import {
  formatNum, generateParticipantInsights, generateBhavcopyInsights,
  calculatePCR, calculateFIILongShortRatio, analyzeStrikes,
} from '../utils/insights';

const SENTIMENT_MAP = {
  bullish: { color: 'success', icon: '📈', bg: '#1b5e2010' },
  bearish: { color: 'error', icon: '📉', bg: '#b7161610' },
  caution: { color: 'warning', icon: '⚠️', bg: '#e6510010' },
  info: { color: 'info', icon: '📊', bg: '#1565c010' },
};

export default function InsightsPanel() {
  const { participantData, bhavcopyData, darkMode } = useData();

  const latestParticipant = participantData[participantData.length - 1] || null;
  const latestFutures = bhavcopyData.filter((d) => d.type === 'futures').slice(-1)[0] || null;
  const latestOptions = bhavcopyData.filter((d) => d.type === 'options').slice(-1)[0] || null;

  const participantInsights = useMemo(() => generateParticipantInsights(latestParticipant), [latestParticipant]);
  const bhavcopyInsights = useMemo(() => generateBhavcopyInsights(latestFutures, latestOptions), [latestFutures, latestOptions]);

  // PCR summary
  const pcrData = useMemo(() => {
    if (!latestOptions?.records?.length) return null;
    const nearExpiry = getNearMonthExpiry(latestOptions.records);
    const filteredRecs = nearExpiry
      ? latestOptions.records.filter((r) => r.expiry === nearExpiry)
      : latestOptions.records;

    const overall = calculatePCR(filteredRecs);
    const indexOnly = calculatePCR(filteredRecs.filter((r) => r.segment === 'Index'));
    const stockOnly = calculatePCR(filteredRecs.filter((r) => r.segment === 'Stock'));

    return { overall, indexOnly, stockOnly, expiry: nearExpiry };
  }, [latestOptions]);

  // Participant position pie chart
  const positionPieChart = useMemo(() => {
    if (!latestParticipant) return {};
    const parts = latestParticipant.participants;
    const data = parts.map((p) => ({
      name: p.clientType,
      value: p.totalLong + p.totalShort,
    }));
    const COLORS = ['#42a5f5', '#ff7043', '#ab47bc', '#26a69a'];
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        data: data.map((d, i) => ({ ...d, itemStyle: { color: COLORS[i] } })),
        label: { color: darkMode ? '#ccc' : '#333' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      }],
    };
  }, [latestParticipant, darkMode]);

  // FII long/short breakdown pie
  const fiiBreakdownChart = useMemo(() => {
    if (!latestParticipant) return {};
    const fii = latestParticipant.participants.find((p) => p.clientType === 'FII');
    if (!fii) return {};

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        data: [
          { name: 'Fut Idx Long', value: fii.futIdxL, itemStyle: { color: '#4caf50' } },
          { name: 'Fut Idx Short', value: fii.futIdxS, itemStyle: { color: '#f44336' } },
          { name: 'Fut Stk Long', value: fii.futStkL, itemStyle: { color: '#66bb6a' } },
          { name: 'Fut Stk Short', value: fii.futStkS, itemStyle: { color: '#ef5350' } },
          { name: 'Opt Call Short', value: fii.optIdxCS + fii.optStkCS, itemStyle: { color: '#ff9800' } },
          { name: 'Opt Put Short', value: fii.optIdxPS + fii.optStkPS, itemStyle: { color: '#9c27b0' } },
        ],
        label: { color: darkMode ? '#ccc' : '#333', fontSize: 11 },
      }],
    };
  }, [latestParticipant, darkMode]);

  // FII Long/Short Ratio (latest)
  const fiiLSData = useMemo(() => {
    const ratioData = calculateFIILongShortRatio(participantData);
    return ratioData.filter((d) => d.ratio !== null);
  }, [participantData]);

  // Max Pain trend across days
  const maxPainTrend = useMemo(() => {
    const optData = bhavcopyData.filter((d) => d.type === 'options').sort((a, b) => a.date.localeCompare(b.date));
    return optData.map((d) => {
      const nearExpiry = getNearMonthExpiry(d.records);
      const niftyAnalysis = analyzeStrikes(d.records, 'NIFTY', nearExpiry);
      const bnAnalysis = analyzeStrikes(d.records, 'BANKNIFTY', nearExpiry);
      return {
        date: d.date,
        niftyMaxPain: niftyAnalysis?.maxPain || null,
        bnMaxPain: bnAnalysis?.maxPain || null,
        niftyUnderlying: niftyAnalysis?.underlyingValue || null,
        bnUnderlying: bnAnalysis?.underlyingValue || null,
      };
    }).filter((d) => d.niftyMaxPain || d.bnMaxPain);
  }, [bhavcopyData]);

  // Max Pain trend chart
  const maxPainTrendChart = useMemo(() => {
    if (!maxPainTrend.length) return {};
    const hasNifty = maxPainTrend.some((d) => d.niftyMaxPain);
    const hasBN = maxPainTrend.some((d) => d.bnMaxPain);
    const series = [];
    if (hasNifty) {
      series.push({
        name: 'NIFTY Max Pain',
        type: 'line',
        data: maxPainTrend.map((d) => d.niftyMaxPain),
        lineStyle: { width: 2.5, color: '#5c6bc0' },
        itemStyle: { color: '#5c6bc0' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
      });
      series.push({
        name: 'NIFTY Underlying',
        type: 'line',
        data: maxPainTrend.map((d) => d.niftyUnderlying),
        lineStyle: { width: 1.5, color: '#5c6bc0', type: 'dashed' },
        itemStyle: { color: '#5c6bc0' },
        smooth: true,
        symbol: 'diamond',
        symbolSize: 5,
      });
    }
    if (hasBN) {
      series.push({
        name: 'BANKNIFTY Max Pain',
        type: 'line',
        yAxisIndex: hasBN && hasNifty ? 1 : 0,
        data: maxPainTrend.map((d) => d.bnMaxPain),
        lineStyle: { width: 2.5, color: '#ff9800' },
        itemStyle: { color: '#ff9800' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
      });
      series.push({
        name: 'BANKNIFTY Underlying',
        type: 'line',
        yAxisIndex: hasBN && hasNifty ? 1 : 0,
        data: maxPainTrend.map((d) => d.bnUnderlying),
        lineStyle: { width: 1.5, color: '#ff9800', type: 'dashed' },
        itemStyle: { color: '#ff9800' },
        smooth: true,
        symbol: 'diamond',
        symbolSize: 5,
      });
    }
    const yAxes = [{
      type: 'value',
      name: hasNifty ? 'NIFTY' : 'BANKNIFTY',
      axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => v.toLocaleString('en-IN') },
      splitLine: { lineStyle: { color: darkMode ? '#333' : '#e0e0e0' } },
    }];
    if (hasNifty && hasBN) {
      yAxes.push({
        type: 'value',
        name: 'BANKNIFTY',
        position: 'right',
        axisLabel: { color: darkMode ? '#ccc' : '#333', formatter: (v) => v.toLocaleString('en-IN') },
        splitLine: { show: false },
      });
    }
    return {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: darkMode ? '#ccc' : '#333' } },
      toolbox: { feature: { saveAsImage: { title: 'Save' } }, right: 10 },
      grid: { left: 80, right: hasBN && hasNifty ? 80 : 30, top: 60, bottom: 30 },
      xAxis: {
        type: 'category',
        data: maxPainTrend.map((d) => formatDate(d.date)),
        axisLabel: { color: darkMode ? '#ccc' : '#333', rotate: 30 },
      },
      yAxis: yAxes,
      series,
    };
  }, [maxPainTrend, darkMode]);

  if (!participantData.length && !bhavcopyData.length) {
    return <Alert severity="info">Upload CSV files to see automated insights.</Alert>;
  }

  return (
    <Box>
      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {latestParticipant && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Latest Participant Data</Typography>
                <Typography variant="h6">{formatDate(latestParticipant.date)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {pcrData && (
          <>
            <Grid item xs={6} sm={3} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Overall PCR</Typography>
                  <Typography variant="h5" sx={{ color: pcrData.overall.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    {pcrData.overall.oiPCR.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Index PCR</Typography>
                  <Typography variant="h5" sx={{ color: pcrData.indexOnly.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    {pcrData.indexOnly.oiPCR.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Stock PCR</Typography>
                  <Typography variant="h5" sx={{ color: pcrData.stockOnly.oiPCR > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    {pcrData.stockOnly.oiPCR.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Near Expiry</Typography>
                  <Typography variant="h6">{pcrData.expiry || 'N/A'}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Participant insights */}
        {participantInsights.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Participant OI Insights</Typography>
                <Divider sx={{ mb: 2 }} />
                {participantInsights.map((ins, i) => {
                  const meta = SENTIMENT_MAP[ins.sentiment] || SENTIMENT_MAP.info;
                  return (
                    <Alert key={i} severity={meta.color} sx={{ mb: 1 }} icon={false}>
                      <Typography variant="body2">
                        {meta.icon} {ins.text}
                      </Typography>
                    </Alert>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Bhavcopy insights */}
        {bhavcopyInsights.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Market Insights</Typography>
                <Divider sx={{ mb: 2 }} />
                {bhavcopyInsights.map((ins, i) => {
                  const meta = SENTIMENT_MAP[ins.sentiment] || SENTIMENT_MAP.info;
                  return (
                    <Alert key={i} severity={meta.color} sx={{ mb: 1 }} icon={false}>
                      <Typography variant="body2">
                        {meta.icon} {ins.text}
                      </Typography>
                    </Alert>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Participant market share */}
        {latestParticipant && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Market Participation Share</Typography>
                <ReactECharts option={positionPieChart} style={{ height: 350 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* FII breakdown */}
        {latestParticipant?.participants?.find((p) => p.clientType === 'FII') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>FII Position Breakdown</Typography>
                <ReactECharts option={fiiBreakdownChart} style={{ height: 350 }} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* FII Index L/S Ratio */}
        {fiiLSData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card sx={{ border: '1px solid', borderColor: (fiiLSData[fiiLSData.length - 1]?.ratio || 0) >= 1 ? 'success.main' : 'error.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>FII Index Futures L/S Ratio</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="h3" fontWeight={700} sx={{
                    color: (fiiLSData[fiiLSData.length - 1]?.ratio || 0) >= 1 ? 'success.main' : 'error.main',
                  }}>
                    {fiiLSData[fiiLSData.length - 1]?.ratio?.toFixed(2) || '-'}
                  </Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Long: {formatNum(fiiLSData[fiiLSData.length - 1]?.longContracts || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Short: {formatNum(fiiLSData[fiiLSData.length - 1]?.shortContracts || 0)}
                    </Typography>
                  </Box>
                  <Chip
                    label={(fiiLSData[fiiLSData.length - 1]?.ratio || 0) >= 1 ? 'FII Bullish' : 'FII Bearish'}
                    color={(fiiLSData[fiiLSData.length - 1]?.ratio || 0) >= 1 ? 'success' : 'error'}
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Ratio &gt; 1 = FII net long in index futures (bullish) | &lt; 1 = net short (bearish)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Max Pain Trend */}
        {maxPainTrend.length >= 2 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Max Pain Trend — NIFTY / BANKNIFTY</Typography>
                <ReactECharts option={maxPainTrendChart} style={{ height: 350 }} />
                <Typography variant="caption" color="text.secondary">
                  Solid = Max Pain | Dashed = Underlying — Max Pain drift direction confirms positioning bias
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Net positions summary */}
        {latestParticipant && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Net Position Summary</Typography>
                <Grid container spacing={2}>
                  {latestParticipant.participants.map((p) => {
                    const futNet = (p.futIdxL + p.futStkL) - (p.futIdxS + p.futStkS);
                    const optNet = (p.optIdxCL + p.optIdxPL + p.optStkCL + p.optStkPL)
                      - (p.optIdxCS + p.optIdxPS + p.optStkCS + p.optStkPS);
                    const totalNet = p.totalLong - p.totalShort;
                    return (
                      <Grid item xs={12} sm={6} md={3} key={p.clientType}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                              {p.clientType}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" color="text.secondary">Net Futures</Typography>
                              <Typography variant="body2" fontWeight={600}
                                sx={{ color: futNet >= 0 ? 'success.main' : 'error.main' }}
                              >
                                {futNet >= 0 ? '+' : ''}{formatNum(futNet)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" color="text.secondary">Net Options</Typography>
                              <Typography variant="body2" fontWeight={600}
                                sx={{ color: optNet >= 0 ? 'success.main' : 'error.main' }}
                              >
                                {optNet >= 0 ? '+' : ''}{formatNum(optNet)}
                              </Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" fontWeight={600}>Total Net</Typography>
                              <Chip
                                label={`${totalNet >= 0 ? '+' : ''}${formatNum(totalNet)}`}
                                size="small"
                                color={totalNet >= 0 ? 'success' : 'error'}
                                sx={{ fontWeight: 700 }}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
