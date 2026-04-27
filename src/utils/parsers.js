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

  // MCX commodity detection — check if CONTRACT_D starts with FUTCOM/OPTFUT
  if (headers.includes('CONTRACT_D')) {
    const sampleLines = text.split('\n').slice(1, 10).join('\n');
    if (/FUTCOM|OPTFUT|FUTCUR|OPTCUR/i.test(sampleLines)) return 'commodity';
  }

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

/* ───────── Commodity Contract Parsers ───────── */

// MCX contract descriptions:
//   FUTCOM CRUDEOIL 19-MAY-2026     (commodity futures)
//   OPTFUT GOLD 30-MAY-2026 CE 72000 (options on commodity futures)
//   FUTCUR USDINR 27-MAY-2026        (currency futures)
//   OPTCUR USDINR 27-MAY-2026 CE 84  (currency options)

function parseCommodityFuturesContract(desc) {
  const m = desc.match(/^(FUTCOM|FUTCUR)\s+(.+?)\s+(\d{2}-[A-Z]{3}-\d{4})$/);
  if (!m) return null;
  const isCurrency = m[1] === 'FUTCUR';
  return {
    instrumentType: m[1],
    segment: isCurrency ? 'Currency' : 'Commodity',
    symbol: m[2].trim(),
    expiry: m[3],
    optionType: null,
    strikePrice: null,
  };
}

function parseCommodityOptionsContract(desc) {
  const m = desc.match(/^(OPTFUT|OPTCUR)\s+(.+?)\s+(\d{2}-[A-Z]{3}-\d{4})\s+(CE|PE)\s+(.+)$/);
  if (!m) return null;
  const isCurrency = m[1] === 'OPTCUR';
  return {
    instrumentType: m[1],
    segment: isCurrency ? 'Currency' : 'Commodity',
    symbol: m[2].trim(),
    expiry: m[3],
    optionType: m[4],
    strikePrice: parseFloat(m[5]),
  };
}

/* ───────── Bhavcopy – Commodity (MCX / Currency) ───────── */

export function parseCommodityBhavcopy(text, filename) {
  const date = extractDateFromFilename(filename);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });

  const futuresRecords = [];
  const optionsRecords = [];

  for (const row of parsed.data) {
    const desc = (row.CONTRACT_D || '').trim();
    
    // Try futures first
    let contract = parseCommodityFuturesContract(desc);
    if (contract) {
      futuresRecords.push({
        ...contract,
        previousSettle: Number(row.PREVIOUS_S) || 0,
        openPrice: Number(row.OPEN_PRICE) || 0,
        highPrice: Number(row.HIGH_PRICE) || 0,
        lowPrice: Number(row.LOW_PRICE) || 0,
        closePrice: Number(row.CLOSE_PRIC) || 0,
        settlementPrice: Number(row.SETTLEMENT) || 0,
        netChangePct: Number(row.NET_CHANGE) || 0,
        oi: Number(row.OI_NO_CON) || 0,
        volume: Number(row.TRADED_QUA) || 0,
        contracts: Number(row.TRD_NO_CON) || 0,
        tradedValue: Number(row.TRADED_VAL) || 0,
      });
      continue;
    }

    // Try options
    contract = parseCommodityOptionsContract(desc);
    if (contract) {
      optionsRecords.push({
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
  }

  return {
    date,
    filename,
    type: 'commodity',
    futuresRecords,
    optionsRecords,
    totalFutures: futuresRecords.length,
    totalOptions: optionsRecords.length,
  };
}

/* ───────── Commodity Helpers ───────── */

export const COMMODITY_INFO = {
  CRUDEOIL: { name: 'Crude Oil', unit: 'BBL', lotSize: 100, exchange: 'MCX', category: 'Energy' },
  NATURALGAS: { name: 'Natural Gas', unit: 'mmBtu', lotSize: 1250, exchange: 'MCX', category: 'Energy' },
  GOLD: { name: 'Gold', unit: '10 gms', lotSize: 100, exchange: 'MCX', category: 'Precious Metals' },
  GOLDM: { name: 'Gold Mini', unit: '10 gms', lotSize: 10, exchange: 'MCX', category: 'Precious Metals' },
  GOLDPETAL: { name: 'Gold Petal', unit: '1 gm', lotSize: 1, exchange: 'MCX', category: 'Precious Metals' },
  SILVER: { name: 'Silver', unit: 'KG', lotSize: 30, exchange: 'MCX', category: 'Precious Metals' },
  SILVERM: { name: 'Silver Mini', unit: 'KG', lotSize: 5, exchange: 'MCX', category: 'Precious Metals' },
  SILVERMIC: { name: 'Silver Micro', unit: 'KG', lotSize: 1, exchange: 'MCX', category: 'Precious Metals' },
  COPPER: { name: 'Copper', unit: 'KG', lotSize: 2500, exchange: 'MCX', category: 'Base Metals' },
  ZINC: { name: 'Zinc', unit: 'KG', lotSize: 5000, exchange: 'MCX', category: 'Base Metals' },
  ALUMINIUM: { name: 'Aluminium', unit: 'KG', lotSize: 5000, exchange: 'MCX', category: 'Base Metals' },
  LEAD: { name: 'Lead', unit: 'KG', lotSize: 5000, exchange: 'MCX', category: 'Base Metals' },
  NICKEL: { name: 'Nickel', unit: 'KG', lotSize: 1500, exchange: 'MCX', category: 'Base Metals' },
  MENTHAOIL: { name: 'Mentha Oil', unit: 'KG', lotSize: 360, exchange: 'MCX', category: 'Agri' },
  COTTON: { name: 'Cotton', unit: 'Bales', lotSize: 25, exchange: 'MCX', category: 'Agri' },
  USDINR: { name: 'USD/INR', unit: '$', lotSize: 1000, exchange: 'NSE-CDS', category: 'Currency' },
  EURINR: { name: 'EUR/INR', unit: '€', lotSize: 1000, exchange: 'NSE-CDS', category: 'Currency' },
  GBPINR: { name: 'GBP/INR', unit: '£', lotSize: 1000, exchange: 'NSE-CDS', category: 'Currency' },
  JPYINR: { name: 'JPY/INR', unit: '¥', lotSize: 1000, exchange: 'NSE-CDS', category: 'Currency' },
};

export function getCommodityCategory(symbol) {
  return COMMODITY_INFO[symbol]?.category || 'Other';
}

export function getCommodityName(symbol) {
  return COMMODITY_INFO[symbol]?.name || symbol;
}
