/**
 * @file RTK Query API slice
 * @description Defines the base query configuration and all RTK Query
 * endpoints. This is the single source of truth for all server data fetching,
 * caching, and invalidation in the client application.
 *
 * Endpoints are injected by feature modules to keep the codebase modular.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base query factory that attaches the JWT access token to every request.
 * Token is read from Redux state (memory only — never localStorage to prevent XSS).
 * On 401 responses, the base query attempts a token refresh before retrying.
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  /**
   * Reads the access token from Redux state and adds it as a Bearer header.
   * This runs before every RTK Query request.
   */
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
  // Include credentials so the browser sends the HttpOnly refresh token cookie
  credentials: 'include',
});

/**
 * Base query with automatic token refresh on 401.
 * When a request returns 401, silently calls /auth/refresh to get a new
 * access token, then retries the original request with the new token.
 *
 * @param {object} args - RTK Query request args
 * @param {object} api - RTK Query API utilities
 * @param {object} extraOptions - Extra options
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result?.error?.status === 401) {
    // Attempt token refresh using the HttpOnly cookie
    const refreshResult = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);

    if (refreshResult?.data?.data?.accessToken) {
      // Store the new access token in Redux state
      const { setAccessToken } = await import('../features/auth/authSlice.js');
      api.dispatch(setAccessToken(refreshResult.data.data.accessToken));

      // Retry the original request with the new token
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      // Refresh failed — clear auth state so the user is redirected to login
      const { logout } = await import('../features/auth/authSlice.js');
      api.dispatch(logout());
    }
  }

  return result;
};

/**
 * Central RTK Query API instance.
 * All feature endpoints are injected via injectEndpoints() in their respective
 * feature files to keep the API slice modular.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  // Tag types used for cache invalidation across all endpoints
  tagTypes: [
    'Incident',
    'Comment',
    'Attachment',
    'User',
    'Team',
    'Notification',
    'Dashboard',
    'AuditLog',
  ],
  // Empty endpoints — injected by feature modules
  endpoints: () => ({}),
});
