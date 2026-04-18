import { useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, LinearProgress, Divider,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useData } from '../context/DataContext';
import { calculateSentimentScore } from '../utils/insights';

function ScoreGauge({ score, darkMode }) {
  const option = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: -100,
      max: 100,
      center: ['50%', '75%'],
      radius: '100%',
      splitNumber: 10,
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.2, '#f44336'],
            [0.35, '#ff5722'],
            [0.5, '#ff9800'],
            [0.65, '#ffeb3b'],
            [0.8, '#8bc34a'],
            [1, '#4caf50'],
          ],
        },
      },
      pointer: {
        length: '60%',
        width: 6,
        itemStyle: { color: darkMode ? '#fff' : '#333' },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        distance: 25,
        color: darkMode ? '#aaa' : '#666',
        fontSize: 11,
        formatter: (v) => {
          if (v === -100) return 'Bearish';
          if (v === 0) return 'Neutral';
          if (v === 100) return 'Bullish';
          return '';
        },
      },
      detail: {
        valueAnimation: true,
        formatter: (v) => {
          if (v > 30) return `+${v} Bullish`;
          if (v < -30) return `${v} Bearish`;
          return `${v} Neutral`;
        },
        color: score > 30 ? '#4caf50' : score < -30 ? '#f44336' : '#ff9800',
        fontSize: 22,
        fontWeight: 700,
        offsetCenter: [0, '-10%'],
      },
      data: [{ value: score }],
    }],
  }), [score, darkMode]);

  return <ReactECharts option={option} style={{ height: 260 }} />;
}

export default function SentimentScorecard() {
  const { participantData, bhavcopyData, darkMode } = useData();

  const { score, factors } = useMemo(
    () => calculateSentimentScore(participantData, bhavcopyData),
    [participantData, bhavcopyData],
  );

  const sentimentLabel = score > 30 ? 'Bullish' : score > 10 ? 'Mildly Bullish' :
    score < -30 ? 'Bearish' : score < -10 ? 'Mildly Bearish' : 'Neutral';
  const sentimentColor = score > 30 ? 'success' : score > 10 ? 'success' :
    score < -30 ? 'error' : score < -10 ? 'error' : 'warning';

  if (!participantData.length && !bhavcopyData.length) return null;

  return (
    <Card sx={{ mb: 3, border: '2px solid', borderColor: `${sentimentColor}.main` }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          {/* Gauge */}
          <Grid item xs={12} md={5}>
            <Typography variant="h6" textAlign="center" gutterBottom>
              Market Sentiment Scorecard
            </Typography>
            <ScoreGauge score={score} darkMode={darkMode} />
            <Box sx={{ textAlign: 'center', mt: -2 }}>
              <Chip
                label={sentimentLabel}
                color={sentimentColor}
                sx={{ fontWeight: 700, fontSize: 14, px: 2 }}
              />
            </Box>
          </Grid>

          {/* Factors breakdown */}
          <Grid item xs={12} md={7}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Score Breakdown
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            {factors.map((f, i) => (
              <Box key={i} sx={{ mb: 1.2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {f.sentiment === 'bullish' ? '📈' : f.sentiment === 'bearish' ? '📉' : '➖'} {f.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ color: f.value > 0 ? 'success.main' : f.value < 0 ? 'error.main' : 'text.secondary' }}
                  >
                    {f.value > 0 ? '+' : ''}{f.value}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.abs(f.value) / 25 * 100}
                  color={f.value > 0 ? 'success' : f.value < 0 ? 'error' : 'inherit'}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            ))}
            {factors.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Upload more data to generate sentiment signals
              </Typography>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
