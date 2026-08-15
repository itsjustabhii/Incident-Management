/**
 * @file Auth Redux slice
 * @description Manages authentication state in Redux.
 *
 * Security design:
 *   • The access token lives ONLY in Redux memory — it is never written to
 *     localStorage or sessionStorage to prevent XSS token theft.
 *   • The refresh token lives ONLY in an HttpOnly server-set cookie — JS cannot
 *     read it at all, preventing both XSS and manual extraction.
 *   • Session restoration on page refresh works by calling /auth/refresh which
 *     reads the HttpOnly cookie automatically — no token survives in JS storage.
 *   • The user's role is sourced from the server-returned profile, not from the
 *     JWT payload directly, so frontend role checks always reflect the DB state.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from './authApi.js';

/**
 * Async thunk that restores the session on app load by calling /auth/refresh.
 * If the HttpOnly cookie is present and valid, a new rotated access token is
 * issued and the user's profile is fetched.
 * This runs once in App.jsx on mount so authenticated users stay logged in
 * across page refreshes without ever touching localStorage.
 */
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    try {
      // Attempt to exchange the HttpOnly cookie for a fresh access token
      const refreshResult = await dispatch(authApi.endpoints.refresh.initiate());
      if (refreshResult.data?.data?.accessToken) {
        const accessToken = refreshResult.data.data.accessToken;
        // Fetch the user profile to populate the full user object in state
        const meResult = await dispatch(authApi.endpoints.getMe.initiate());
        return {
          accessToken,
          user: meResult.data?.data?.user || null,
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
    // True while the app is checking for an existing session on first load.
    // Prevents a flash of the login page for users with a valid cookie.
    isInitializing: true,
  },
  reducers: {
    /**
     * Called by the RTK Query base query when a token refresh succeeds
     * (e.g., after a 401 triggers the auto-refresh logic in store/api.js).
     * Updates the in-memory access token without touching any storage.
     */
    setAccessToken(state, action) {
      state.accessToken = action.payload;
    },

    /**
     * Sets the full auth state after a successful login or registration.
     * Dispatched from the login/register page components after unwrapping
     * the API response.
     */
    setCredentials(state, action) {
      const { user, accessToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.isAuthenticated = true;
      state.isInitializing = false;
    },

    /**
     * Clears all auth state.
     * Called on explicit logout, session expiry, or when token reuse is detected.
     * After this runs, any route wrapped in AuthGuard will redirect to /login.
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
        // Failed to restore session — treat as logged out
        state.isInitializing = false;
      });
  },
});

export const { setAccessToken, setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────────────

/** Returns the currently authenticated user object (or null) */
export const selectCurrentUser = (state) => state.auth.user;

/** Returns the JWT access token (in-memory only) */
export const selectAccessToken = (state) => state.auth.accessToken;

/** Returns true when the user is authenticated */
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/** Returns true while the app is checking for an existing session */
export const selectIsInitializing = (state) => state.auth.isInitializing;

/** Returns the authenticated user's role string, or null if not authenticated */
export const selectCurrentRole = (state) => state.auth.user?.role ?? null;

/** Returns true if the current user is an ADMIN */
export const selectIsAdmin = (state) => state.auth.user?.role === 'ADMIN';

/** Returns true if the current user is a MANAGER or higher */
export const selectIsManager = (state) =>
  state.auth.user?.role === 'ADMIN' || state.auth.user?.role === 'MANAGER';

/** Returns true if the current user is a SUPPORT_ENGINEER or higher */
export const selectIsSupportEngineerOrAbove = (state) =>
  ['ADMIN', 'MANAGER', 'SUPPORT_ENGINEER'].includes(state.auth.user?.role);

/** Returns true if the current user is a VIEWER (read-only) */
export const selectIsViewer = (state) => state.auth.user?.role === 'VIEWER';
