import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, IconButton, TextField,
  Autocomplete, Alert, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper,
} from '@mui/material';
import { Add, Delete, Star } from '@mui/icons-material';
import { useData } from '../context/DataContext';
import { getNearMonthExpiry, getSymbols } from '../utils/parsers';
import { formatNum, calculatePCR, analyzeStrikes } from '../utils/insights';

export default function Watchlist() {
  const { watchlist, addToWatchlist, removeFromWatchlist, bhavcopyData, darkMode } = useData();
  const [newSymbol, setNewSymbol] = useState(null);

  // Get all available symbols from data
  const allSymbols = useMemo(() => {
    const syms = new Set();
    for (const d of bhavcopyData) {
      for (const r of d.records) syms.add(r.symbol);
    }
    return [...syms].sort();
  }, [bhavcopyData]);

  // Latest data
  const latestFutures = useMemo(
    () => bhavcopyData.filter((d) => d.type === 'futures').slice(-1)[0] || null,
    [bhavcopyData],
  );
  const latestOptions = useMemo(
    () => bhavcopyData.filter((d) => d.type === 'options').slice(-1)[0] || null,
    [bhavcopyData],
  );
  const prevFutures = useMemo(() => {
    const futs = bhavcopyData.filter((d) => d.type === 'futures');
    return futs.length >= 2 ? futs[futs.length - 2] : null;
  }, [bhavcopyData]);

  // Build watchlist data
  const watchlistData = useMemo(() => {
    return watchlist.map((symbol) => {
      const result = { symbol };

      // Futures data
      if (latestFutures) {
        const nearExpiry = getNearMonthExpiry(latestFutures.records);
        const futRecs = latestFutures.records.filter((r) => r.symbol === symbol && r.expiry === nearExpiry);
        if (futRecs.length) {
          result.closePrice = futRecs[0].closePrice;
          result.netChangePct = futRecs[0].netChangePct;
          result.oi = futRecs.reduce((sum, r) => sum + r.oi, 0);
          result.volume = futRecs.reduce((sum, r) => sum + r.volume, 0);
        }

        // OI change vs previous day
        if (prevFutures) {
          const prevNearExpiry = getNearMonthExpiry(prevFutures.records);
          const prevFutRecs = prevFutures.records.filter((r) => r.symbol === symbol && r.expiry === prevNearExpiry);
          const prevOI = prevFutRecs.reduce((sum, r) => sum + r.oi, 0);
          result.oiChange = (result.oi || 0) - prevOI;
        }
      }

      // Options PCR
      if (latestOptions) {
        const nearExpiry = getNearMonthExpiry(latestOptions.records);
        const optRecs = latestOptions.records.filter((r) => r.symbol === symbol && r.expiry === nearExpiry);
        if (optRecs.length) {
          const pcr = calculatePCR(optRecs);
          result.pcr = pcr.oiPCR;

          // Strike analysis
          const analysis = analyzeStrikes(latestOptions.records, symbol, nearExpiry);
          if (analysis) {
            result.maxPain = analysis.maxPain;
            result.support = analysis.immSupport?.strike;
            result.resistance = analysis.immResistance?.strike;
          }
        }
      }

      return result;
    });
  }, [watchlist, latestFutures, latestOptions, prevFutures]);

  const handleAdd = () => {
    if (newSymbol && !watchlist.includes(newSymbol)) {
      addToWatchlist(newSymbol);
      setNewSymbol(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Star sx={{ color: '#ffca28' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>Watchlist</Typography>
        <Autocomplete
          size="small"
          options={allSymbols.filter((s) => !watchlist.includes(s))}
          value={newSymbol}
          onChange={(_, v) => setNewSymbol(v)}
          renderInput={(params) => <TextField {...params} label="Add Symbol" placeholder="Search..." />}
          sx={{ minWidth: 200 }}
          clearOnEscape
        />
        <IconButton
          onClick={handleAdd}
          color="primary"
          disabled={!newSymbol}
          sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
        >
          <Add />
        </IconButton>
      </Box>

      {/* Quick add popular symbols */}
      {watchlist.length === 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Quick add popular symbols:</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS', 'ICICIBANK'].map((s) => (
              <Chip
                key={s}
                label={s}
                onClick={() => addToWatchlist(s)}
                clickable
                variant="outlined"
                color="primary"
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}

      {watchlist.length === 0 && (
        <Alert severity="info">
          Add symbols to your watchlist to see OI, PCR, max pain, and support/resistance at a glance.
        </Alert>
      )}

      {/* Watchlist cards */}
      {watchlistData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {watchlistData.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.symbol}>
              <Card sx={{ position: 'relative', height: '100%' }}>
                <IconButton
                  size="small"
                  onClick={() => removeFromWatchlist(item.symbol)}
                  sx={{ position: 'absolute', top: 4, right: 4, opacity: 0.5, '&:hover': { opacity: 1 } }}
                >
                  <Delete fontSize="small" />
                </IconButton>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{item.symbol}</Typography>

                  {item.closePrice != null && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" fontWeight={600}>₹{item.closePrice?.toFixed(2)}</Typography>
                      <Chip
                        label={`${item.netChangePct >= 0 ? '+' : ''}${item.netChangePct?.toFixed(2)}%`}
                        size="small"
                        color={item.netChangePct >= 0 ? 'success' : 'error'}
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>
                  )}

                  <Divider sx={{ my: 1 }} />

                  <Grid container spacing={0.5}>
                    {item.oi != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">OI</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatNum(item.oi)}</Typography>
                      </Grid>
                    )}
                    {item.oiChange != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">OI Change</Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ color: item.oiChange >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {item.oiChange >= 0 ? '+' : ''}{formatNum(item.oiChange)}
                        </Typography>
                      </Grid>
                    )}
                    {item.pcr != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">PCR</Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: item.pcr > 1 ? 'success.main' : 'error.main' }}
                        >
                          {item.pcr.toFixed(2)}
                        </Typography>
                      </Grid>
                    )}
                    {item.maxPain != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Max Pain</Typography>
                        <Typography variant="body2" fontWeight={600} color="info.main">
                          {item.maxPain.toLocaleString('en-IN')}
                        </Typography>
                      </Grid>
                    )}
                    {item.support != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Support</Typography>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          {item.support.toLocaleString('en-IN')}
                        </Typography>
                      </Grid>
                    )}
                    {item.resistance != null && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Resistance</Typography>
                        <Typography variant="body2" fontWeight={600} color="error.main">
                          {item.resistance.toLocaleString('en-IN')}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Watchlist Table Summary */}
      {watchlistData.length > 0 && watchlistData.some((d) => d.closePrice != null) && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Watchlist Summary</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Change %</TableCell>
                    <TableCell align="right">OI</TableCell>
                    <TableCell align="right">OI Change</TableCell>
                    <TableCell align="right">PCR</TableCell>
                    <TableCell align="right">Max Pain</TableCell>
                    <TableCell align="right">Support</TableCell>
                    <TableCell align="right">Resistance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {watchlistData.map((item) => (
                    <TableRow key={item.symbol} hover>
                      <TableCell><strong>{item.symbol}</strong></TableCell>
                      <TableCell align="right">{item.closePrice?.toFixed(2) || '-'}</TableCell>
                      <TableCell align="right" sx={{ color: (item.netChangePct || 0) >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                        {item.netChangePct != null ? `${item.netChangePct >= 0 ? '+' : ''}${item.netChangePct.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell align="right">{item.oi != null ? formatNum(item.oi) : '-'}</TableCell>
                      <TableCell align="right" sx={{ color: (item.oiChange || 0) >= 0 ? 'success.main' : 'error.main' }}>
                        {item.oiChange != null ? `${item.oiChange >= 0 ? '+' : ''}${formatNum(item.oiChange)}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: (item.pcr || 0) > 1 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                        {item.pcr != null ? item.pcr.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'info.main' }}>
                        {item.maxPain?.toLocaleString('en-IN') || '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>
                        {item.support?.toLocaleString('en-IN') || '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>
                        {item.resistance?.toLocaleString('en-IN') || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
