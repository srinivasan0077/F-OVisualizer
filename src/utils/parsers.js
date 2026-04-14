import Papa from 'papaparse';

/* ───────── Date helpers ───────── */

export function extractDateFromFilename(filename) {
  const base = filename.replace(/\\/g, '/').split('/').pop().replace(/\.csv$/i, '');

  // fao_participant_oi_DDMMYYYY
  const m1 = base.match(/(\d{2})(\d{2})(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

  // foDDMMYY or opDDMMYY
  const m2 = base.match(/(\d{2})(\d{2})(\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`;

  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ───────── File‑type detection ───────── */

export function detectFileType(text) {
  const firstLine = text.split('\n')[0];
  if (/participant|open interest/i.test(firstLine)) return 'participant';

  const headers = firstLine.split(',').map((h) => h.trim().toUpperCase());
  if (headers.includes('UNDRLNG_ST') || headers.includes('PREMIUM_TR') || headers.includes('NOTIONAL_V'))
    return 'options';
  if (headers.includes('CONTRACT_D')) {
    const secondLine = text.split('\n')[1] || '';
    if (/^OPT/i.test(secondLine.trim())) return 'options';
    return 'futures';
  }
  return 'unknown';
}

/* ───────── Participant‑wise OI parser ───────── */

export function parseParticipantOI(text, filename) {
  const lines = text.trim().split('\n');

  // Extract date from the descriptive header (avoid Date object to prevent timezone shifts)
  let date = null;
  const dateMatch = lines[0].match(/(\w{3})\s+(\d{2}),\s+(\d{4})/);
  if (dateMatch) {
    const monthMap = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const mm = monthMap[dateMatch[1]];
    if (mm) date = `${dateMatch[3]}-${mm}-${dateMatch[2]}`;
  }
  if (!date) date = extractDateFromFilename(filename);

  // CSV starts from line 2 (index 1)
  const csvText = lines.slice(1).join('\n');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (h) => h.trim(),
  });

  // Build a normalised‑key → original‑header map
  const colMap = {};
  if (parsed.meta?.fields) {
    for (const field of parsed.meta.fields) {
      colMap[field.trim().toLowerCase().replace(/\s+/g, '_')] = field;
    }
  }

  function getVal(row, key) {
    const field = colMap[key];
    return field !== undefined ? Number(row[field]) || 0 : 0;
  }

  const participants = [];
  let totals = null;

  for (const row of parsed.data) {
    const ctField = colMap['client_type'] || Object.keys(row)[0];
    const clientType = (row[ctField] || '').toString().trim();
    if (!clientType) continue;

    const record = {
      clientType,
      futIdxL: getVal(row, 'future_index_long'),
      futIdxS: getVal(row, 'future_index_short'),
      futStkL: getVal(row, 'future_stock_long'),
      futStkS: getVal(row, 'future_stock_short'),
      optIdxCL: getVal(row, 'option_index_call_long'),
      optIdxPL: getVal(row, 'option_index_put_long'),
      optIdxCS: getVal(row, 'option_index_call_short'),
      optIdxPS: getVal(row, 'option_index_put_short'),
      optStkCL: getVal(row, 'option_stock_call_long'),
      optStkPL: getVal(row, 'option_stock_put_long'),
      optStkCS: getVal(row, 'option_stock_call_short'),
      optStkPS: getVal(row, 'option_stock_put_short'),
      totalLong: getVal(row, 'total_long_contracts'),
      totalShort: getVal(row, 'total_short_contracts'),
    };

    if (clientType === 'TOTAL') {
      totals = record;
    } else {
      participants.push(record);
    }
  }

  return { date, filename, participants, totals };
}

/* ───────── Contract description parsers ───────── */

function parseFuturesContract(desc) {
  const m = desc.match(/^(FUTSTK|FUTIDX)(.+?)(\d{2}-[A-Z]{3}-\d{4})$/);
  if (!m) return null;
  return {
    instrumentType: m[1],
    segment: m[1] === 'FUTIDX' ? 'Index' : 'Stock',
    symbol: m[2],
    expiry: m[3],
  };
}

function parseOptionsContract(desc) {
  const m = desc.match(/^(OPTSTK|OPTIDX)(.+?)(\d{2}-[A-Z]{3}-\d{4})(CE|PE)(.+)$/);
  if (!m) return null;
  return {
    instrumentType: m[1],
    segment: m[1] === 'OPTIDX' ? 'Index' : 'Stock',
    symbol: m[2],
    expiry: m[3],
    optionType: m[4],
    strikePrice: parseFloat(m[5]),
  };
}

/* ───────── Bhavcopy – Futures ───────── */

export function parseBhavcopyFutures(text, filename) {
  const date = extractDateFromFilename(filename);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });

  const records = [];
  for (const row of parsed.data) {
    const contract = parseFuturesContract((row.CONTRACT_D || '').trim());
    if (!contract) continue;

    const prevSettle = Number(row.PREVIOUS_S) || 0;
    const settlement = Number(row.SETTLEMENT) || 0;

    records.push({
      ...contract,
      previousSettle: prevSettle,
      openPrice: Number(row.OPEN_PRICE) || 0,
      highPrice: Number(row.HIGH_PRICE) || 0,
      lowPrice: Number(row.LOW_PRICE) || 0,
      closePrice: Number(row.CLOSE_PRIC) || 0,
      settlementPrice: settlement,
      netChangePct: Number(row.NET_CHANGE) || 0,
      oi: Number(row.OI_NO_CON) || 0,
      volume: Number(row.TRADED_QUA) || 0,
      contracts: Number(row.TRD_NO_CON) || 0,
      tradedValue: Number(row.TRADED_VAL) || 0,
    });
  }

  return { date, filename, type: 'futures', records };
}

/* ───────── Bhavcopy – Options ───────── */

export function parseBhavcopyOptions(text, filename) {
  const date = extractDateFromFilename(filename);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });

  const records = [];
  for (const row of parsed.data) {
    const contract = parseOptionsContract((row.CONTRACT_D || '').trim());
    if (!contract) continue;

    records.push({
      ...contract,
      previousSettle: Number(row.PREVIOUS_S) || 0,
      openPrice: Number(row.OPEN_PRICE) || 0,
      highPrice: Number(row.HIGH_PRICE) || 0,
      lowPrice: Number(row.LOW_PRICE) || 0,
      closePrice: Number(row.CLOSE_PRIC) || 0,
      settlementPrice: Number(row.SETTLEMENT) || 0,
      netChange: Number(row.NET_CHANGE) || 0,
      oi: Number(row.OI_NO_CON) || 0,
      volume: Number(row.TRADED_QUA) || 0,
      contracts: Number(row.TRD_NO_CON) || 0,
      underlyingValue: Number(row.UNDRLNG_ST) || 0,
      notionalValue: Number(row.NOTIONAL_V) || 0,
      premiumTraded: Number(row.PREMIUM_TR) || 0,
    });
  }

  return { date, filename, type: 'options', records };
}

/* ───────── Helpers for aggregation ───────── */

export function getNearMonthExpiry(records) {
  const expiries = [...new Set(records.map((r) => r.expiry))];
  expiries.sort((a, b) => new Date(a) - new Date(b));
  return expiries[0] || null;
}

export function aggregateBySymbol(records, expiry) {
  const filtered = expiry ? records.filter((r) => r.expiry === expiry) : records;
  const map = {};
  for (const r of filtered) {
    if (!map[r.symbol]) {
      map[r.symbol] = {
        symbol: r.symbol,
        segment: r.segment,
        oi: 0,
        volume: 0,
        tradedValue: 0,
        closePrice: 0,
        previousSettle: 0,
        netChangePct: 0,
        contracts: 0,
        count: 0,
      };
    }
    const agg = map[r.symbol];
    agg.oi += r.oi;
    agg.volume += r.volume;
    agg.tradedValue += r.tradedValue || 0;
    agg.contracts += r.contracts;
    agg.count++;
    // Keep near-month price (first encountered for this symbol)
    if (!agg.closePrice && r.closePrice) {
      agg.closePrice = r.closePrice;
      agg.previousSettle = r.previousSettle;
      agg.netChangePct = r.netChangePct;
    }
  }
  return Object.values(map);
}

export function getExpiries(records) {
  return [...new Set(records.map((r) => r.expiry))].sort((a, b) => new Date(a) - new Date(b));
}

export function getSymbols(records) {
  return [...new Set(records.map((r) => r.symbol))].sort();
}
