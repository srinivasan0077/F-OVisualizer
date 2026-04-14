import { createTheme } from '@mui/material/styles';

export function createAppTheme(darkMode) {
  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#5c6bc0' },
      secondary: { main: '#ff9800' },
      success: { main: '#4caf50' },
      error: { main: '#f44336' },
      ...(darkMode
        ? {
            background: { default: '#0d1117', paper: '#161b22' },
          }
        : {
            background: { default: '#f0f2f5', paper: '#ffffff' },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  });
}
