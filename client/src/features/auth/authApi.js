/**
 * @file Auth RTK Query endpoints
 * @description Injects authentication endpoints into the central API slice.
 * Keeps auth API calls co-located with the auth feature rather than scattered.
 *
 * Security notes:
 *   • The refresh token travels only as an HttpOnly cookie (set by the server).
 *     It is never readable by JavaScript — credentials: 'include' in the base
 *     query ensures the browser sends it automatically.
 *   • The /auth/refresh call now returns a new rotated refresh token cookie AND
 *     a new access token body — the browser handles the Set-Cookie update automatically.
 */

import { api } from '../../store/api.js';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * POST /auth/login
     * Authenticates with email + password.
     * Returns the user object and access token in the body.
     * The refresh token is set as an HttpOnly cookie by the server — JS cannot read it.
     */
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    /**
     * POST /auth/register
     * Creates a new user account and immediately issues tokens.
     */
    register: builder.mutation({
      query: (data) => ({
        url: '/auth/register',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * POST /auth/logout
     * Revokes the refresh token on the server and clears the cookie.
     * Requires a valid access token (Authorization header) so the server
     * knows which user is logging out.
     * Invalidates all cached data to prevent stale data from a prior session.
     */
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      // Clear all cached server state on logout — prior user's data must not linger
      invalidatesTags: ['Incident', 'User', 'Notification', 'Dashboard', 'Comment', 'Team'],
    }),

    /**
     * POST /auth/refresh
     * Issues a new access token AND a new rotated refresh token.
     * The browser sends the current refresh token cookie automatically (credentials:'include').
     * The server returns the new rotated refresh token as a Set-Cookie header.
     * Called automatically by the base query reauth logic on 401 responses and on app init.
     */
    refresh: builder.mutation({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
    }),

    /**
     * GET /auth/me
     * Returns the current user's full profile.
     * Called after a successful refresh to populate the user object in Redux.
     */
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),

    /**
     * POST /auth/change-password
     * Changes the authenticated user's password.
     * Requires the current password to prevent session-fixation attacks.
     * All existing sessions are revoked by the server on success.
     */
    changePassword: builder.mutation({
      query: (data) => ({
        url: '/auth/change-password',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * GET /auth/sessions
     * Returns all active sessions for the current user.
     */
    getSessions: builder.query({
      query: () => '/auth/sessions',
    }),

    /**
     * DELETE /auth/sessions/:sessionId
     * Revokes a specific session (remote logout from another device).
     */
    revokeSession: builder.mutation({
      query: (sessionId) => ({
        url: `/auth/sessions/${sessionId}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshMutation,
  useGetMeQuery,
  useChangePasswordMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
} = authApi;
