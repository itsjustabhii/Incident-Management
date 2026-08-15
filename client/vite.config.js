import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite configuration for the Incident Management Platform client.
 *
 * Key decisions:
 * - '@' alias maps to src/ to keep import paths short and readable
 * - API proxy rewrites /api and /socket.io calls to the Express server during
 *   development, avoiding CORS issues and matching the production nginx setup
 * - Source maps enabled in development for debuggable stack traces
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // '@/features/auth' resolves to 'src/features/auth'
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    port: 3000,
    host: '0.0.0.0',
    // Proxy API and WebSocket calls to the backend in development
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    // Generate source maps for production error tracking (Sentry, etc.)
    sourcemap: true,
    // Split vendor chunk to improve long-term caching — React, MUI, etc.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          charts: ['recharts'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
});
