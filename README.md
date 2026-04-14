# F&O Visualizer – NSE Data Analysis Dashboard

A full-stack web application for uploading, parsing, and visualizing NSE F&O data from CSV files.

## Features

- **Drag & Drop Upload** – Upload CSV files with automatic format detection
- **Participant-wise OI** – Visualize Client, DII, FII, Pro positions across segments
- **Bhavcopy Analysis** – Top movers by OI, volume, price; PCR by symbol
- **Comparison** – Compare two dates: OI change, position change, buildup classification
- **Auto Insights** – Net positions, PCR, FII vs retail divergence, buildup detection
- **Dark Mode** – Toggle between dark and light themes
- **Export Charts** – Save any chart as an image (click the save icon on each chart)

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
    ├── App.jsx                   # App shell, tabs, theme
    ├── App.css                   # Global styles
    ├── theme.js                  # MUI theme configuration
    ├── context/
    │   └── DataContext.jsx       # Shared state management
    ├── utils/
    │   ├── parsers.js            # CSV parsing & data normalization
    │   └── insights.js           # Analysis & insight generation
    └── components/
        ├── FileUpload.jsx        # Drag & drop file upload
        ├── ParticipantDashboard.jsx  # Participant OI visualizations
        ├── BhavcopyDashboard.jsx     # Bhavcopy charts & tables
        ├── ComparisonView.jsx        # Multi-date comparison
        └── InsightsPanel.jsx         # Automated insights & PCR
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
