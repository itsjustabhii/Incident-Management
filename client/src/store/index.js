/**
 * @file Redux store configuration
 * @description Creates the root Redux store with RTK Query middleware,
 * Redux DevTools support, and all feature slices registered.
 */

import { configureStore } from '@reduxjs/toolkit';
import { api } from './api.js';
import authReducer from '../features/auth/authSlice.js';
import notificationReducer from '../features/notifications/notificationSlice.js';
import uiReducer from './uiSlice.js';

/**
 * Root Redux store.
 * All slices and the RTK Query API middleware are registered here.
 * The store is created once and passed to the Provider in main.jsx.
 */
export const store = configureStore({
  reducer: {
    // RTK Query API slice — manages all server state and cache
    [api.reducerPath]: api.reducer,

    // Feature slices — manage global client state
    auth: authReducer,
    notifications: notificationReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      // RTK Query middleware handles cache invalidation, polling, etc.
      api.middleware,
    ),
  // Enable Redux DevTools in development for time-travel debugging
  devTools: import.meta.env.DEV,
});
