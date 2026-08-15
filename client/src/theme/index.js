/**
 * @file MUI theme configuration
 * @description Defines the Material UI theme tokens used across the entire app.
 * Centralising theme values here means changing the brand colour requires a
 * single edit rather than hunting through component files.
 */

import { createTheme } from '@mui/material/styles';

/**
 * Custom Material UI theme for IncidentHub.
 * Uses a blue primary (professional/corporate) with an amber accent
 * for SLA breach warnings, which carry inherent urgency.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565C0',      // Deep blue — authority and trust
      light: '#5E92F3',
      dark: '#003c8f',
    },
    secondary: {
      main: '#7B1FA2',      // Purple — secondary actions
    },
    error: {
      main: '#C62828',
    },
    warning: {
      main: '#F57F17',      // Amber — SLA at-risk indicators
    },
    success: {
      main: '#2E7D32',
    },
    background: {
      default: '#F4F6F8',   // Slightly off-white page background
      paper: '#FFFFFF',
    },
    // Custom semantic colours for incident priority badges
    priority: {
      critical: '#B71C1C',
      high: '#E65100',
      medium: '#F57F17',
      low: '#1B5E20',
    },
  },

  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  },

  shape: {
    borderRadius: 8,
  },

  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Disable ALL-CAPS on buttons
          fontWeight: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});
