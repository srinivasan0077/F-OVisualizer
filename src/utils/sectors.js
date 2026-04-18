/* ───────── Sector Classification for NSE F&O Stocks ───────── */

const SECTOR_MAP = {
  // IT & Technology
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT', LTIM: 'IT',
  MPHASIS: 'IT', COFORGE: 'IT', PERSISTENT: 'IT', LTTS: 'IT',

  // Banking
  HDFCBANK: 'Banking', ICICIBANK: 'Banking', SBIN: 'Banking', KOTAKBANK: 'Banking',
  AXISBANK: 'Banking', INDUSINDBK: 'Banking', BANDHANBNK: 'Banking', PNB: 'Banking',
  BANKBARODA: 'Banking', IDFCFIRSTB: 'Banking', FEDERALBNK: 'Banking', AUBANK: 'Banking',
  CANBK: 'Banking', RBLBANK: 'Banking', MANAPPURAM: 'Banking',

  // Financial Services
  BAJFINANCE: 'Finance', BAJAJFINSV: 'Finance', SBILIFE: 'Finance', HDFCLIFE: 'Finance',
  ICICIPRULI: 'Finance', CHOLAFIN: 'Finance', MUTHOOTFIN: 'Finance', SHRIRAMFIN: 'Finance',
  LICHSGFIN: 'Finance', POONAWALLA: 'Finance', MCX: 'Finance', ICICIGI: 'Finance',
  SBICARD: 'Finance', PFC: 'Finance', RECLTD: 'Finance',

  // Energy & Oil
  RELIANCE: 'Energy', ONGC: 'Energy', IOC: 'Energy', BPCL: 'Energy', GAIL: 'Energy',
  NTPC: 'Energy', POWERGRID: 'Energy', ADANIGREEN: 'Energy', TATAPOWER: 'Energy',
  ADANIENT: 'Energy', PETRONET: 'Energy', HINDPETRO: 'Energy', COALINDIA: 'Energy',
  NHPC: 'Energy', SJVN: 'Energy', IREDA: 'Energy',

  // Automobile
  TATAMOTORS: 'Auto', MARUTI: 'Auto', M_M: 'Auto', BAJAJ_AUTO: 'Auto', HEROMOTOCO: 'Auto',
  EICHERMOT: 'Auto', ASHOKLEY: 'Auto', TVSMOTOR: 'Auto', BALKRISIND: 'Auto',
  BHARATFORG: 'Auto', MRF: 'Auto', MOTHERSON: 'Auto', EXIDEIND: 'Auto',
  TATAMTRDVR: 'Auto', APOLLOTYRE: 'Auto',
  // Handle symbols with & replaced
  'M&M': 'Auto', 'BAJAJ-AUTO': 'Auto',

  // Pharma & Healthcare
  SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma', DIVISLAB: 'Pharma',
  APOLLOHOSP: 'Pharma', BIOCON: 'Pharma', AUROPHARMA: 'Pharma', TORNTPHARM: 'Pharma',
  LUPIN: 'Pharma', ALKEM: 'Pharma', IPCALAB: 'Pharma', LALPATHLAB: 'Pharma',
  MAXHEALTH: 'Pharma', LAURUSLABS: 'Pharma', GLENMARK: 'Pharma', NATCOPHARMA: 'Pharma',
  ZYDUSLIFE: 'Pharma', GRANULES: 'Pharma',

  // FMCG
  HINDUNILVR: 'FMCG', ITC: 'FMCG', NESTLEIND: 'FMCG', BRITANNIA: 'FMCG',
  DABUR: 'FMCG', GODREJCP: 'FMCG', MARICO: 'FMCG', COLPAL: 'FMCG',
  TATACONSUM: 'FMCG', UBL: 'FMCG', MCDOWELL_N: 'FMCG', VBL: 'FMCG',
  EMAMILTD: 'FMCG', PGHH: 'FMCG', 'MCDOWELL-N': 'FMCG',

  // Metals & Mining
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals', VEDL: 'Metals',
  NMDC: 'Metals', SAIL: 'Metals', NATIONALUM: 'Metals', JINDALSTEL: 'Metals',
  APLAPOLLO: 'Metals', RATNAMANI: 'Metals', HINDZINC: 'Metals',

  // Cement & Construction
  ULTRACEMCO: 'Cement', SHREECEM: 'Cement', AMBUJACEM: 'Cement', ACC: 'Cement',
  DALBHARAT: 'Cement', RAMCOCEM: 'Cement', JKCEMENT: 'Cement',

  // Infrastructure & Realty
  LT: 'Infra', ADANIPORTS: 'Infra', DLF: 'Realty', GODREJPROP: 'Realty',
  OBEROIRLTY: 'Realty', PRESTIGE: 'Realty', PHOENIXLTD: 'Realty',
  BRIGADE: 'Realty', LODHA: 'Realty', IRCTC: 'Infra', CONCOR: 'Infra',

  // Telecom & Media
  BHARTIARTL: 'Telecom', IDEA: 'Telecom', ZEEL: 'Media', PVR: 'Media',

  // Chemicals
  PIDILITIND: 'Chemicals', SRF: 'Chemicals', ATUL: 'Chemicals', UPL: 'Chemicals',
  PIIND: 'Chemicals', DEEPAKNTR: 'Chemicals', NAVINFLUOR: 'Chemicals',
  CLEAN: 'Chemicals', AARTIIND: 'Chemicals',

  // Consumer Durables
  TITAN: 'Consumer', HAVELLS: 'Consumer', VOLTAS: 'Consumer', WHIRLPOOL: 'Consumer',
  BATAINDIA: 'Consumer', PAGEIND: 'Consumer', RAJESHEXPO: 'Consumer',
  CROMPTON: 'Consumer', DIXON: 'Consumer', KALYANKJIL: 'Consumer',

  // Indices
  NIFTY: 'Index', BANKNIFTY: 'Index', FINNIFTY: 'Index', MIDCPNIFTY: 'Index',
  NIFTYNXT50: 'Index',
};

const SECTOR_COLORS = {
  IT: '#42a5f5',
  Banking: '#5c6bc0',
  Finance: '#7e57c2',
  Energy: '#ff7043',
  Auto: '#26a69a',
  Pharma: '#66bb6a',
  FMCG: '#ffca28',
  Metals: '#8d6e63',
  Cement: '#78909c',
  Infra: '#29b6f6',
  Realty: '#ec407a',
  Telecom: '#ab47bc',
  Media: '#ff8a65',
  Chemicals: '#9ccc65',
  Consumer: '#ffa726',
  Index: '#e0e0e0',
  Other: '#555555',
};

export function getSector(symbol) {
  return SECTOR_MAP[symbol] || 'Other';
}

export function getSectorColor(sector) {
  return SECTOR_COLORS[sector] || SECTOR_COLORS.Other;
}

export function getAllSectors() {
  return Object.keys(SECTOR_COLORS);
}

export function groupBySector(records) {
  const groups = {};
  for (const r of records) {
    const sector = getSector(r.symbol);
    if (!groups[sector]) groups[sector] = { sector, symbols: [], totalOI: 0, totalVolume: 0, count: 0 };
    groups[sector].symbols.push(r);
    groups[sector].totalOI += r.oi || r.totalOI || 0;
    groups[sector].totalVolume += r.volume || r.totalVol || 0;
    groups[sector].count++;
  }
  return Object.values(groups).sort((a, b) => b.totalOI - a.totalOI);
}

export { SECTOR_COLORS };
