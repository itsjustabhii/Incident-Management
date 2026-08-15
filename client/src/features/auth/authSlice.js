/**
 * @file Auth Redux slice
 * @description Manages authentication state in Redux.
 * The access token lives ONLY in Redux memory — it is never written to
 * localStorage or sessionStorage to prevent XSS token theft.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from './authApi.js';

/**
 * Async thunk that restores the session on app load by calling /auth/refresh.
 * If the HttpOnly cookie is present and valid, a new access token is issued.
 * This runs once in App.jsx's useEffect so the user stays logged in across
 * page refreshes without storing the token in localStorage.
 */
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    try {
      const result = await dispatch(authApi.endpoints.refresh.initiate());
      if (result.data?.data?.accessToken) {
        return {
          accessToken: result.data.data.accessToken,
          user: result.data.data.user || null,
        };
      }
      return null;
    } catch {
      // Refresh failed — user needs to log in manually
      return null;
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isInitializing: true, // True while checking for an existing session on app load
  },
  reducers: {
    /**
     * Called by the RTK Query base query when a token refresh succeeds.
     * Updates the in-memory access token without touching storage.
     */
    setAccessToken(state, action) {
      state.accessToken = action.payload;
    },

    /**
     * Sets the full auth state after a successful login or registration.
     */
    setCredentials(state, action) {
      const { user, accessToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.isAuthenticated = true;
      state.isInitializing = false;
    },

    /**
     * Clears all auth state. Called on logout or when a refresh fails.
     */
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (action.payload?.accessToken) {
          state.accessToken = action.payload.accessToken;
          state.isAuthenticated = true;
          if (action.payload.user) {
            state.user = action.payload.user;
          }
        }
        state.isInitializing = false;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isInitializing = false;
      });
  },
});

export const { setAccessToken, setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────────────

/** Returns the currently authenticated user object */
export const selectCurrentUser = (state) => state.auth.user;

/** Returns the JWT access token (in-memory only) */
export const selectAccessToken = (state) => state.auth.accessToken;

/** Returns true when the user is authenticated */
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/** Returns true while the app is checking for an existing session */
export const selectIsInitializing = (state) => state.auth.isInitializing;
