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
