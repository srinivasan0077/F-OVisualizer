# F&O Visualizer – NSE Data Analysis Dashboard

A full-stack web application for uploading, parsing, and visualizing NSE F&O data from CSV files.

## Features

### Core
- **Drag & Drop Upload** – Upload CSV files with automatic format detection
- **Participant-wise OI** – Visualize Client, DII, FII, Pro positions across segments
- **Bhavcopy Analysis** – Top movers by OI, volume, price; PCR by symbol
- **Comparison** – Compare two dates: OI change, position change, buildup classification
- **Auto Insights** – Net positions, PCR, FII vs retail divergence, buildup detection
- **Dark Mode** – Toggle between dark and light themes
- **Export Charts** – Save any chart as an image (click the save icon on each chart)
- **Persistent Storage** – All uploaded data persists in IndexedDB across browser refreshes

### Advanced Analysis (New)
- **Sentiment Scorecard** – Composite sentiment gauge (-100 to +100) from FII positioning, PCR, buildup classification
- **Multi-Day Trend Tracker** – Track FII net positions, PCR, and L/S ratio across N days as time-series charts
- **FII Index Long/Short Ratio** – The single most-watched institutional metric, tracked over time
- **Change in OI (COI)** – Strike-wise OI delta heatmap showing fresh writing vs unwinding
- **Straddle/Strangle Zones** – OI-implied range (highest Call OI + highest Put OI) for range-bound strategy decisions
- **IV Smile/Skew** – Estimated implied volatility by strike with abnormally high IV detection
- **Expiry Rollover Analysis** – Near vs next month OI with rollover % and cost analysis
- **Max Pain Trend** – Multi-day max pain drift for NIFTY/BANKNIFTY
- **Sector Heatmap** – Treemap and bar charts showing sector-wise OI/volume distribution
- **Watchlist** – Pin symbols and see OI, PCR, max pain, support/resistance at a glance
- **Keyboard Shortcuts** – `1-8` switch tabs, `D` toggle dark mode, `U` open upload

## Supported CSV Formats

| File Pattern | Type |
|---|---|
| `fao_participant_oi_DDMMYYYY.csv` | Participant-wise Open Interest |
| `foDDMMYY.csv` | Futures Bhavcopy |
| `opDDMMYY.csv` | Options Bhavcopy |

## How to Run Locally

### Prerequisites

- **Node.js** v18 or later – [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Steps

```bash
# 1. Navigate to the project folder
cd F&OVisualizer

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will open automatically at **http://localhost:3000**.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. Open the app in your browser
2. Drag & drop your NSE CSV files onto the upload area (or click to browse)
3. Files are auto-detected and parsed:
   - **Participant OI** files → go to the "Participant OI" tab
   - **Futures/Options Bhavcopy** files → go to the "Bhavcopy" tab
4. Upload multiple dates for the **Comparison** tab
5. Check the **Insights** tab for automated analysis

## Project Structure

```
F&OVisualizer/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.jsx                  # Entry point
    ├── App.jsx                   # App shell, tabs, theme, keyboard shortcuts
    ├── App.css                   # Global styles
    ├── theme.js                  # MUI theme configuration
    ├── context/
    │   └── DataContext.jsx       # Shared state + IndexedDB persistence
    ├── utils/
    │   ├── parsers.js            # CSV parsing & data normalization
    │   ├── insights.js           # Analysis, scoring, IV, COI, rollover
    │   ├── storage.js            # IndexedDB persistence layer
    │   └── sectors.js            # Sector classification & colors
    └── components/
        ├── FileUpload.jsx            # Drag & drop file upload
        ├── ParticipantDashboard.jsx  # Participant OI visualizations
        ├── BhavcopyDashboard.jsx     # Bhavcopy charts & tables
        ├── ComparisonView.jsx        # Multi-date comparison
        ├── MultiDayTrend.jsx         # N-day trend tracker (FII L/S, PCR, positions)
        ├── AdvancedAnalysis.jsx      # COI, straddle zones, IV smile, rollover
        ├── Watchlist.jsx             # Symbol pinning with key metrics
        ├── SectorHeatmap.jsx         # Sector-wise OI/volume treemap
        ├── SentimentScorecard.jsx    # Composite sentiment gauge
        ├── InsightsPanel.jsx         # Automated insights, FII L/S, max pain trend
        └── StrikeAnalysis.jsx        # Strike-wise OI, PCR, volume, max pain
```

## Tech Stack

- **React 18** – UI framework
- **Vite** – Build tool
- **Material UI (MUI)** – Component library
- **ECharts** – Interactive charts
- **PapaParse** – CSV parsing
- **react-dropzone** – File drag & drop

## Extensibility

- Add new parsers in `src/utils/parsers.js` with a new `detectFileType` case
- Add new chart components in `src/components/`
- The `DataContext` can be extended to support new data types
