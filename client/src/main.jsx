/**
 * @file Application entry point
 * @description Renders the React app into the DOM. Wraps the application with:
 *   - Redux Provider (global state)
 *   - React Router BrowserRouter (client-side navigation)
 *   - MUI ThemeProvider (design system)
 *   - ErrorBoundary (top-level crash protection)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App.jsx';
import { store } from './store/index.js';
import { theme } from './theme/index.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Redux store is provided at the root so all components can access state */}
    <Provider store={store}>
      {/* BrowserRouter enables React Router's URL-based navigation */}
      <BrowserRouter>
        {/* MUI ThemeProvider applies the custom design tokens globally */}
        <ThemeProvider theme={theme}>
          {/* CssBaseline normalizes browser default styles */}
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
