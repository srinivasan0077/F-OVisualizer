/* ───────── Sentiment Scorecard ───────── */

export function calculateSentimentScore(participantData, bhavcopyData) {
  let score = 0;
  let factors = [];

  const latestP = participantData[participantData.length - 1];
  const latestFut = bhavcopyData.filter((d) => d.type === 'futures').slice(-1)[0];
  const latestOpt = bhavcopyData.filter((d) => d.type === 'options').slice(-1)[0];

  if (latestP) {
    const fii = latestP.participants.find((p) => p.clientType === 'FII');
    const client = latestP.participants.find((p) => p.clientType === 'Client');

    if (fii) {
      // FII Index Futures net — most important signal
      const fiiIdxNet = fii.futIdxL - fii.futIdxS;
      const fiiIdxRatio = fii.futIdxL / (fii.futIdxS || 1);
      if (fiiIdxRatio > 1.2) { score += 25; factors.push({ label: 'FII Index Futures Long', value: +25, sentiment: 'bullish' }); }
      else if (fiiIdxRatio < 0.8) { score -= 25; factors.push({ label: 'FII Index Futures Short', value: -25, sentiment: 'bearish' }); }
      else { factors.push({ label: 'FII Index Futures Neutral', value: 0, sentiment: 'neutral' }); }

      // FII options writing bias
      const fiiCallShort = fii.optIdxCS + fii.optStkCS;
      const fiiPutShort = fii.optIdxPS + fii.optStkPS;
      if (fiiPutShort > fiiCallShort * 1.3) { score += 15; factors.push({ label: 'FII writing more Puts', value: +15, sentiment: 'bullish' }); }
      else if (fiiCallShort > fiiPutShort * 1.3) { score -= 15; factors.push({ label: 'FII writing more Calls', value: -15, sentiment: 'bearish' }); }

      // FII total net
      const fiiTotalNet = (fii.futIdxL + fii.futStkL) - (fii.futIdxS + fii.futStkS);
      if (fiiTotalNet > 0) { score += 10; factors.push({ label: 'FII net LONG in futures', value: +10, sentiment: 'bullish' }); }
      else { score -= 10; factors.push({ label: 'FII net SHORT in futures', value: -10, sentiment: 'bearish' }); }
    }

    // FII vs Client divergence
    if (fii && client) {
      const fiiNet = (fii.futIdxL + fii.futStkL) - (fii.futIdxS + fii.futStkS);
      const clientNet = (client.futIdxL + client.futStkL) - (client.futIdxS + client.futStkS);
      if (fiiNet > 0 && clientNet < 0) { score += 10; factors.push({ label: 'FII bullish, retail short (smart money aligned)', value: +10, sentiment: 'bullish' }); }
      else if (fiiNet < 0 && clientNet > 0) { score -= 10; factors.push({ label: 'FII bearish, retail bullish (divergence)', value: -10, sentiment: 'bearish' }); }
    }
  }

  // PCR signal
  if (latestOpt?.records?.length) {
    const pcr = calculatePCR(latestOpt.records);
    if (pcr.oiPCR > 1.3) { score += 15; factors.push({ label: `PCR ${pcr.oiPCR.toFixed(2)} — bullish`, value: +15, sentiment: 'bullish' }); }
    else if (pcr.oiPCR > 1.0) { score += 5; factors.push({ label: `PCR ${pcr.oiPCR.toFixed(2)} — mildly bullish`, value: +5, sentiment: 'bullish' }); }
    else if (pcr.oiPCR < 0.7) { score -= 15; factors.push({ label: `PCR ${pcr.oiPCR.toFixed(2)} — bearish`, value: -15, sentiment: 'bearish' }); }
    else if (pcr.oiPCR < 1.0) { score -= 5; factors.push({ label: `PCR ${pcr.oiPCR.toFixed(2)} — mildly bearish`, value: -5, sentiment: 'bearish' }); }
  }

  // Buildup classification from futures (if comparison data available)
  if (bhavcopyData.filter((d) => d.type === 'futures').length >= 2) {
    const futs = bhavcopyData.filter((d) => d.type === 'futures').sort((a, b) => a.date.localeCompare(b.date));
    const prev = futs[futs.length - 2];
    const curr = futs[futs.length - 1];
    if (prev && curr) {
      let longBuildup = 0, shortBuildup = 0;
      const prevMap = {};
      for (const r of prev.records) { if (!prevMap[r.symbol]) prevMap[r.symbol] = r; }
      for (const r of curr.records) {
        const p = prevMap[r.symbol];
        if (!p) continue;
        const oiChange = r.oi - p.oi;
        const b = classifyBuildup(r.netChangePct, oiChange);
        if (b.type === 'Long Buildup') longBuildup++;
        else if (b.type === 'Short Buildup') shortBuildup++;
      }
      const total = longBuildup + shortBuildup;
      if (total > 0) {
        const longPct = longBuildup / total;
        if (longPct > 0.6) { score += 10; factors.push({ label: `${(longPct * 100).toFixed(0)}% stocks in Long Buildup`, value: +10, sentiment: 'bullish' }); }
        else if (longPct < 0.4) { score -= 10; factors.push({ label: `${((1 - longPct) * 100).toFixed(0)}% stocks in Short Buildup`, value: -10, sentiment: 'bearish' }); }
      }
    }
  }

  // Clamp to -100..+100
  score = Math.max(-100, Math.min(100, score));

  return { score, factors };
}

/* ───────── FII Long/Short Ratio ───────── */

export function calculateFIILongShortRatio(participantDataArray) {
  return participantDataArray.map((d) => {
    const fii = d.participants.find((p) => p.clientType === 'FII');
    if (!fii) return { date: d.date, ratio: null, longContracts: 0, shortContracts: 0 };
    const longC = fii.futIdxL;
    const shortC = fii.futIdxS;
    return {
      date: d.date,
      ratio: shortC > 0 ? longC / shortC : null,
      longContracts: longC,
      shortContracts: shortC,
    };
  });
}

/* ───────── Multi-Day Trend Data ───────── */

export function buildMultiDayTrend(participantDataArray) {
  return participantDataArray.map((d) => {
    const result = { date: d.date };
    for (const p of d.participants) {
      const type = p.clientType;
      result[`${type}_futNet`] = (p.futIdxL + p.futStkL) - (p.futIdxS + p.futStkS);
      result[`${type}_optNet`] = (p.optIdxCL + p.optIdxPL + p.optStkCL + p.optStkPL)
        - (p.optIdxCS + p.optIdxPS + p.optStkCS + p.optStkPS);
      result[`${type}_totalNet`] = p.totalLong - p.totalShort;
      result[`${type}_futIdxL`] = p.futIdxL;
      result[`${type}_futIdxS`] = p.futIdxS;
    }
    return result;
  });
}

/* ───────── OI-Based Straddle/Strangle Zones ───────── */

export function calculateStraddleZones(optionsRecords, symbol, expiry) {
  let recs = optionsRecords.filter((r) => r.symbol === symbol);
  if (expiry) recs = recs.filter((r) => r.expiry === expiry);
  if (!recs.length) return null;

  const underlyingValue = recs.find((r) => r.underlyingValue > 0)?.underlyingValue || 0;

  // Aggregate by strike
  const strikeMap = {};
  for (const r of recs) {
    const sp = r.strikePrice;
    if (!strikeMap[sp]) strikeMap[sp] = { strike: sp, callOI: 0, putOI: 0 };
    if (r.optionType === 'CE') strikeMap[sp].callOI += r.oi;
    else strikeMap[sp].putOI += r.oi;
  }
  const strikes = Object.values(strikeMap);

  // Highest Call OI = Resistance (upper range)
  const maxCallOI = strikes.reduce((max, s) => s.callOI > max.callOI ? s : max, strikes[0]);
  // Highest Put OI = Support (lower range)
  const maxPutOI = strikes.reduce((max, s) => s.putOI > max.putOI ? s : max, strikes[0]);

  const upperBound = maxCallOI.strike;
  const lowerBound = maxPutOI.strike;
  const rangeWidth = upperBound - lowerBound;
  const rangeWidthPct = underlyingValue > 0 ? (rangeWidth / underlyingValue * 100) : 0;

  // Straddle zone = ATM strike where combined premium is highest
  let atmStrike = strikes[0]?.strike;
  let minDiff = Infinity;
  for (const s of strikes) {
    const diff = Math.abs(s.strike - underlyingValue);
    if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
  }

  return {
    upperBound,
    lowerBound,
    maxCallOI: maxCallOI.callOI,
    maxPutOI: maxPutOI.putOI,
    rangeWidth,
    rangeWidthPct,
    underlyingValue,
    atmStrike,
  };
}

/* ───────── Change in OI (COI) Analysis ───────── */

export function calculateCOI(prevOptRecords, currOptRecords, symbol, expiry) {
  if (!prevOptRecords?.length || !currOptRecords?.length) return null;

  let prevRecs = prevOptRecords.filter((r) => r.symbol === symbol);
  let currRecs = currOptRecords.filter((r) => r.symbol === symbol);
  if (expiry) {
    prevRecs = prevRecs.filter((r) => r.expiry === expiry);
    currRecs = currRecs.filter((r) => r.expiry === expiry);
  }

  // Build previous OI map by strike+type
  const prevMap = {};
  for (const r of prevRecs) {
    const key = `${r.strikePrice}_${r.optionType}`;
    prevMap[key] = (prevMap[key] || 0) + r.oi;
  }

  // Build current and compute deltas
  const currMap = {};
  for (const r of currRecs) {
    const key = `${r.strikePrice}_${r.optionType}`;
    currMap[key] = (currMap[key] || 0) + r.oi;
  }

  const allStrikes = new Set();
  const strikeData = {};

  for (const key of new Set([...Object.keys(prevMap), ...Object.keys(currMap)])) {
    const [strikeStr, optType] = key.split('_');
    const strike = parseFloat(strikeStr);
    allStrikes.add(strike);

    if (!strikeData[strike]) strikeData[strike] = { strike, callOI: 0, putOI: 0, callCOI: 0, putCOI: 0, callPrevOI: 0, putPrevOI: 0 };
    const prev = prevMap[key] || 0;
    const curr = currMap[key] || 0;
    const change = curr - prev;

    if (optType === 'CE') {
      strikeData[strike].callOI = curr;
      strikeData[strike].callPrevOI = prev;
      strikeData[strike].callCOI = change;
    } else {
      strikeData[strike].putOI = curr;
      strikeData[strike].putPrevOI = prev;
      strikeData[strike].putCOI = change;
    }
  }

  const results = Object.values(strikeData).sort((a, b) => a.strike - b.strike);

  // Determine underlying from current records
  const underlyingValue = currRecs.find((r) => r.underlyingValue > 0)?.underlyingValue || 0;

  // Focus around ATM
  let atmStrike = results[0]?.strike;
  let minDiff = Infinity;
  for (const s of results) {
    const diff = Math.abs(s.strike - underlyingValue);
    if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
  }
  const atmIdx = results.findIndex((s) => s.strike === atmStrike);
  const rangeStart = Math.max(0, atmIdx - 15);
  const rangeEnd = Math.min(results.length, atmIdx + 16);
  const focused = results.slice(rangeStart, rangeEnd);

  return { strikes: results, focused, atmStrike, underlyingValue };
}

/* ───────── Expiry Rollover Analysis ───────── */

export function calculateRollover(futuresRecords) {
  if (!futuresRecords?.length) return [];

  // Get sorted expiries
  const expiries = [...new Set(futuresRecords.map((r) => r.expiry))].sort((a, b) => new Date(a) - new Date(b));
  if (expiries.length < 2) return [];

  const nearExpiry = expiries[0];
  const nextExpiry = expiries[1];

  // Group by symbol
  const symbolMap = {};
  for (const r of futuresRecords) {
    if (!symbolMap[r.symbol]) symbolMap[r.symbol] = {};
    symbolMap[r.symbol][r.expiry] = r;
  }

  const results = [];
  for (const [symbol, expiryMap] of Object.entries(symbolMap)) {
    const near = expiryMap[nearExpiry];
    const next = expiryMap[nextExpiry];
    if (!near || !next) continue;

    const nearOI = near.oi;
    const nextOI = next.oi;
    const totalOI = nearOI + nextOI;
    const rolloverPct = totalOI > 0 ? (nextOI / totalOI * 100) : 0;
    const rolloverCost = next.closePrice - near.closePrice;
    const rolloverCostPct = near.closePrice > 0 ? (rolloverCost / near.closePrice * 100) : 0;

    results.push({
      symbol,
      segment: near.segment,
      nearExpiry,
      nextExpiry,
      nearOI,
      nextOI,
      totalOI,
      rolloverPct,
      rolloverCost,
      rolloverCostPct,
      nearPrice: near.closePrice,
      nextPrice: next.closePrice,
    });
  }

  return results.sort((a, b) => b.totalOI - a.totalOI);
}

/* ───────── IV Estimation (Black-Scholes approximation) ───────── */

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function bsPrice(S, K, T, r, sigma, isCall) {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (isCall) return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

export function estimateIV(marketPrice, S, K, T, r, isCall) {
  if (marketPrice <= 0 || S <= 0 || K <= 0 || T <= 0) return null;

  let low = 0.01, high = 5.0;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const price = bsPrice(S, K, T, r, mid, isCall);
    if (Math.abs(price - marketPrice) < 0.01) return mid;
    if (price > marketPrice) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export function calculateIVSmile(optionsRecords, symbol, expiry, riskFreeRate = 0.065) {
  let recs = optionsRecords.filter((r) => r.symbol === symbol);
  if (expiry) recs = recs.filter((r) => r.expiry === expiry);
  if (!recs.length) return null;

  const underlyingValue = recs.find((r) => r.underlyingValue > 0)?.underlyingValue || 0;
  if (!underlyingValue) return null;

  // Calculate time to expiry in years
  const expiryDate = new Date(expiry);
  const now = new Date();
  const T = Math.max((expiryDate - now) / (365.25 * 24 * 60 * 60 * 1000), 1 / 365);

  // Aggregate by strike
  const strikeMap = {};
  for (const r of recs) {
    const sp = r.strikePrice;
    const price = r.closePrice || r.settlementPrice;
    if (price <= 0) continue;
    if (!strikeMap[sp]) strikeMap[sp] = { strike: sp, callPrice: 0, putPrice: 0, callOI: 0, putOI: 0 };
    if (r.optionType === 'CE') { strikeMap[sp].callPrice = price; strikeMap[sp].callOI += r.oi; }
    else { strikeMap[sp].putPrice = price; strikeMap[sp].putOI += r.oi; }
  }

  const results = [];
  for (const s of Object.values(strikeMap)) {
    const callIV = s.callPrice > 0 ? estimateIV(s.callPrice, underlyingValue, s.strike, T, riskFreeRate, true) : null;
    const putIV = s.putPrice > 0 ? estimateIV(s.putPrice, underlyingValue, s.strike, T, riskFreeRate, false) : null;
    const moneyness = underlyingValue > 0 ? ((s.strike - underlyingValue) / underlyingValue * 100) : 0;
    results.push({
      strike: s.strike,
      callIV: callIV ? callIV * 100 : null,
      putIV: putIV ? putIV * 100 : null,
      avgIV: callIV && putIV ? ((callIV + putIV) / 2 * 100) : (callIV || putIV) ? ((callIV || putIV) * 100) : null,
      moneyness,
      callOI: s.callOI,
      putOI: s.putOI,
    });
  }

  // Sort by strike and focus around ATM
  results.sort((a, b) => a.strike - b.strike);

  let atmStrike = results[0]?.strike;
  let minDiff = Infinity;
  for (const s of results) {
    const diff = Math.abs(s.strike - underlyingValue);
    if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
  }
  const atmIdx = results.findIndex((s) => s.strike === atmStrike);
  const rangeStart = Math.max(0, atmIdx - 12);
  const rangeEnd = Math.min(results.length, atmIdx + 13);
  const focused = results.slice(rangeStart, rangeEnd);

  // Find abnormally high IV (>1.5x median)
  const allIVs = focused.filter((s) => s.avgIV).map((s) => s.avgIV).sort((a, b) => a - b);
  const medianIV = allIVs[Math.floor(allIVs.length / 2)] || 0;
  const highIVStrikes = focused.filter((s) => s.avgIV && s.avgIV > medianIV * 1.5);

  return { strikes: results, focused, atmStrike, underlyingValue, medianIV, highIVStrikes };
}

/* ───────── Buildup classification ───────── */

export function classifyBuildup(priceChangePct, oiChange) {
  if (priceChangePct > 0 && oiChange > 0) return { type: 'Long Buildup', color: '#4caf50', icon: '📈' };
  if (priceChangePct < 0 && oiChange > 0) return { type: 'Short Buildup', color: '#f44336', icon: '📉' };
  if (priceChangePct > 0 && oiChange < 0) return { type: 'Short Covering', color: '#ff9800', icon: '🔄' };
  if (priceChangePct < 0 && oiChange < 0) return { type: 'Long Unwinding', color: '#9c27b0', icon: '⚡' };
  return { type: 'Neutral', color: '#9e9e9e', icon: '➖' };
}

/* ───────── Put‑Call Ratio ───────── */

export function calculatePCR(optionsRecords) {
  let putOI = 0, callOI = 0, putVol = 0, callVol = 0;
  for (const r of optionsRecords) {
    if (r.optionType === 'PE') { putOI += r.oi; putVol += r.volume; }
    else if (r.optionType === 'CE') { callOI += r.oi; callVol += r.volume; }
  }
  return {
    oiPCR: callOI > 0 ? putOI / callOI : 0,
    volumePCR: callVol > 0 ? putVol / callVol : 0,
    totalPutOI: putOI,
    totalCallOI: callOI,
    totalPutVol: putVol,
    totalCallVol: callVol,
  };
}

/* ───────── Number formatting ───────── */

export function formatNum(num) {
  const abs = Math.abs(num);
  if (abs >= 1e7) return (num / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return (num / 1e5).toFixed(2) + ' L';
  if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString('en-IN');
}

/* ───────── Participant insights ───────── */

export function generateParticipantInsights(data) {
  if (!data?.participants?.length) return [];
  const insights = [];
  const { participants } = data;

  for (const p of participants) {
    const type = p.clientType;

    // Net futures position
    const futNet = (p.futIdxL + p.futStkL) - (p.futIdxS + p.futStkS);
    insights.push({
      sentiment: futNet > 0 ? 'bullish' : 'bearish',
      text: `${type} net ${futNet > 0 ? 'LONG' : 'SHORT'} in futures by ${formatNum(Math.abs(futNet))} contracts`,
    });

    // Index futures emphasis
    const idxNet = p.futIdxL - p.futIdxS;
    if (Math.abs(idxNet) > 10000) {
      insights.push({
        sentiment: idxNet > 0 ? 'bullish' : 'bearish',
        text: `${type} heavily ${idxNet > 0 ? 'LONG' : 'SHORT'} in Index Futures (${formatNum(Math.abs(idxNet))} net)`,
      });
    }

    // Options writing pattern (most insightful for FII)
    if (type === 'FII' || type === 'Client') {
      const callShort = p.optIdxCS + p.optStkCS;
      const putShort = p.optIdxPS + p.optStkPS;
      if (putShort > callShort * 1.5) {
        insights.push({
          sentiment: 'bullish',
          text: `${type} writing significantly more Puts than Calls – bullish undertone`,
        });
      } else if (callShort > putShort * 1.5) {
        insights.push({
          sentiment: 'bearish',
          text: `${type} writing significantly more Calls than Puts – bearish pressure`,
        });
      }
    }
  }

  // FII vs Client divergence
  const fii = participants.find((p) => p.clientType === 'FII');
  const client = participants.find((p) => p.clientType === 'Client');
  if (fii && client) {
    const fiiNet = (fii.futIdxL + fii.futStkL) - (fii.futIdxS + fii.futStkS);
    const clientNet = (client.futIdxL + client.futStkL) - (client.futIdxS + client.futStkS);
    if (fiiNet < 0 && clientNet > 0) {
      insights.push({ sentiment: 'caution', text: 'FII bearish but retail bullish – divergence detected' });
    } else if (fiiNet > 0 && clientNet < 0) {
      insights.push({ sentiment: 'bullish', text: 'FII bullish and retail short – smart money aligned bullish' });
    }
  }

  return insights;
}

/* ───────── Bhavcopy insights ───────── */

export function generateBhavcopyInsights(futuresData, optionsData) {
  const insights = [];
  if (!futuresData?.records?.length) return insights;

  const recs = futuresData.records;

  // Top OI
  const topOI = [...recs].filter((r) => r.segment === 'Stock').sort((a, b) => b.oi - a.oi).slice(0, 3);
  if (topOI.length) {
    insights.push({ sentiment: 'info', text: `Highest OI in futures: ${topOI.map((r) => r.symbol).join(', ')}` });
  }

  // Top volume
  const topVol = [...recs].filter((r) => r.segment === 'Stock').sort((a, b) => b.volume - a.volume).slice(0, 3);
  if (topVol.length) {
    insights.push({ sentiment: 'info', text: `Most active by volume: ${topVol.map((r) => r.symbol).join(', ')}` });
  }

  // Top gainers / losers
  const gainers = [...recs].filter((r) => r.segment === 'Stock' && r.netChangePct > 0)
    .sort((a, b) => b.netChangePct - a.netChangePct).slice(0, 3);
  const losers = [...recs].filter((r) => r.segment === 'Stock' && r.netChangePct < 0)
    .sort((a, b) => a.netChangePct - b.netChangePct).slice(0, 3);

  if (gainers.length) {
    insights.push({
      sentiment: 'bullish',
      text: `Top gainers: ${gainers.map((r) => `${r.symbol} (+${r.netChangePct.toFixed(1)}%)`).join(', ')}`,
    });
  }
  if (losers.length) {
    insights.push({
      sentiment: 'bearish',
      text: `Top losers: ${losers.map((r) => `${r.symbol} (${r.netChangePct.toFixed(1)}%)`).join(', ')}`,
    });
  }

  // PCR
  if (optionsData?.records?.length) {
    const pcr = calculatePCR(optionsData.records);
    insights.push({
      sentiment: pcr.oiPCR > 1 ? 'bullish' : 'bearish',
      text: `PCR (OI): ${pcr.oiPCR.toFixed(2)} | PCR (Volume): ${pcr.volumePCR.toFixed(2)}`,
    });
    if (pcr.oiPCR > 1.3) {
      insights.push({ sentiment: 'bullish', text: 'High PCR indicates bullish sentiment – put writers confident' });
    } else if (pcr.oiPCR < 0.7) {
      insights.push({ sentiment: 'bearish', text: 'Low PCR indicates bearish sentiment – call writers dominating' });
    }
  }

  return insights;
}

/* ───────── Comparison insights ───────── */

export function generateComparisonInsights(prev, curr) {
  const insights = [];
  if (!prev || !curr) return insights;

  for (const cp of curr.participants) {
    const pp = prev.participants.find((p) => p.clientType === cp.clientType);
    if (!pp) continue;

    const type = cp.clientType;
    const prevNet = (pp.futIdxL + pp.futStkL) - (pp.futIdxS + pp.futStkS);
    const currNet = (cp.futIdxL + cp.futStkL) - (cp.futIdxS + cp.futStkS);
    const change = currNet - prevNet;

    if (Math.abs(change) > 1000) {
      const dir = change > 0 ? 'increasing long' : 'increasing short';
      insights.push({
        sentiment: change > 0 ? 'bullish' : 'bearish',
        text: `${type} ${dir} positions in futures (${formatNum(Math.abs(change))} contracts change)`,
      });
    }

    // Index futures
    const prevIdx = pp.futIdxL - pp.futIdxS;
    const currIdx = cp.futIdxL - cp.futIdxS;
    const idxChange = currIdx - prevIdx;
    if (Math.abs(idxChange) > 1000) {
      insights.push({
        sentiment: idxChange > 0 ? 'bullish' : 'bearish',
        text: `${type} ${idxChange > 0 ? 'adding longs' : 'adding shorts'} in Index Futures (${formatNum(Math.abs(idxChange))})`,
      });
    }
  }

  return insights;
}

/* ───────── Strike‑wise analysis ───────── */

export function analyzeStrikes(optionsRecords, symbol, expiry) {
  let recs = optionsRecords.filter((r) => r.symbol === symbol);
  if (expiry) recs = recs.filter((r) => r.expiry === expiry);
  if (!recs.length) return null;

  const underlyingValue = recs.find((r) => r.underlyingValue > 0)?.underlyingValue || 0;

  // Build strike map
  const strikeMap = {};
  for (const r of recs) {
    const sp = r.strikePrice;
    if (!strikeMap[sp]) strikeMap[sp] = { strike: sp, callOI: 0, putOI: 0, callVol: 0, putVol: 0, callClose: 0, putClose: 0 };
    const s = strikeMap[sp];
    if (r.optionType === 'CE') { s.callOI += r.oi; s.callVol += r.volume; s.callClose = r.closePrice || r.settlementPrice; }
    else { s.putOI += r.oi; s.putVol += r.volume; s.putClose = r.closePrice || r.settlementPrice; }
  }

  const strikes = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);
  for (const s of strikes) {
    s.pcr = s.callOI > 0 ? s.putOI / s.callOI : null;
    s.totalOI = s.callOI + s.putOI;
  }

  // Max Pain — strike where option buyers lose the most
  let maxPain = null;
  let maxPainLoss = -Infinity;
  const painValues = [];
  for (const target of strikes) {
    let callPain = 0, putPain = 0;
    for (const s of strikes) {
      if (s.strike < target.strike) callPain += (target.strike - s.strike) * s.callOI;
      if (s.strike > target.strike) putPain += (s.strike - target.strike) * s.putOI;
    }
    const totalPain = callPain + putPain;
    painValues.push({ strike: target.strike, callPain, putPain, totalPain });
    if (totalPain > maxPainLoss) { maxPainLoss = totalPain; maxPain = target.strike; }
  }

  // Support & Resistance: high Put OI = support, high Call OI = resistance
  const sortedByPutOI = [...strikes].sort((a, b) => b.putOI - a.putOI);
  const sortedByCallOI = [...strikes].sort((a, b) => b.callOI - a.callOI);

  const supports = sortedByPutOI.slice(0, 3).filter((s) => s.putOI > 0).map((s) => ({
    strike: s.strike, oi: s.putOI, strength: s.putOI / (sortedByPutOI[0]?.putOI || 1),
  }));
  const resistances = sortedByCallOI.slice(0, 3).filter((s) => s.callOI > 0).map((s) => ({
    strike: s.strike, oi: s.callOI, strength: s.callOI / (sortedByCallOI[0]?.callOI || 1),
  }));

  // Immediate support/resistance nearest to underlying
  const immSupport = supports.filter((s) => s.strike <= underlyingValue).sort((a, b) => b.strike - a.strike)[0] || supports[0];
  const immResistance = resistances.filter((s) => s.strike >= underlyingValue).sort((a, b) => a.strike - b.strike)[0] || resistances[0];

  // ATM strike
  let atmStrike = strikes[0]?.strike;
  let minDiff = Infinity;
  for (const s of strikes) {
    const diff = Math.abs(s.strike - underlyingValue);
    if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
  }

  // Focused view: ±15 strikes around ATM
  const atmIdx = strikes.findIndex((s) => s.strike === atmStrike);
  const rangeStart = Math.max(0, atmIdx - 15);
  const rangeEnd = Math.min(strikes.length, atmIdx + 16);
  const focusedStrikes = strikes.slice(rangeStart, rangeEnd);

  // Insights
  const insights = [];
  if (maxPain) {
    insights.push({ sentiment: 'info', text: `Max Pain at ${maxPain.toLocaleString('en-IN')} — option writers profit most if ${symbol} expires here` });
  }
  if (immSupport) {
    insights.push({ sentiment: 'bullish', text: `Strong support at ${immSupport.strike.toLocaleString('en-IN')} (Put OI: ${formatNum(immSupport.oi)})` });
  }
  if (immResistance) {
    insights.push({ sentiment: 'bearish', text: `Strong resistance at ${immResistance.strike.toLocaleString('en-IN')} (Call OI: ${formatNum(immResistance.oi)})` });
  }
  if (underlyingValue && maxPain) {
    const diff = ((maxPain - underlyingValue) / underlyingValue * 100).toFixed(1);
    if (Math.abs(diff) > 0.5) {
      insights.push({
        sentiment: diff > 0 ? 'bullish' : 'bearish',
        text: `Underlying (${underlyingValue.toLocaleString('en-IN')}) is ${Math.abs(diff)}% ${diff > 0 ? 'below' : 'above'} Max Pain — potential ${diff > 0 ? 'upside' : 'downside'} pull`,
      });
    }
  }
  const atmData = strikes.find((s) => s.strike === atmStrike);
  if (atmData?.pcr != null) {
    if (atmData.pcr > 1.5) {
      insights.push({ sentiment: 'bullish', text: `ATM PCR is ${atmData.pcr.toFixed(2)} — put writers dominant at ATM, bullish signal` });
    } else if (atmData.pcr < 0.5) {
      insights.push({ sentiment: 'bearish', text: `ATM PCR is ${atmData.pcr.toFixed(2)} — call writers dominant at ATM, bearish signal` });
    }
  }

  return { strikes, focusedStrikes, maxPain, painValues, supports, resistances, immSupport, immResistance, underlyingValue, atmStrike, insights };
}
