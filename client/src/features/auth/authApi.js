/**
 * @file Auth RTK Query endpoints
 * @description Injects authentication endpoints into the central API slice.
 * Keeps auth API calls co-located with the auth feature rather than scattered.
 */

import { api } from '../../store/api.js';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * POST /auth/login — Authenticates with email + password.
     * Returns the user object and access token. Refresh token is set
     * in an HttpOnly cookie by the server response.
     */
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    /**
     * POST /auth/register — Creates a new user account.
     */
    register: builder.mutation({
      query: (data) => ({
        url: '/auth/register',
        method: 'POST',
        body: data,
      }),
    }),

    /**
     * POST /auth/logout — Revokes the refresh token and clears the cookie.
     */
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      // Invalidate all cached data on logout so stale user data is not shown
      invalidatesTags: ['Incident', 'User', 'Notification', 'Dashboard'],
    }),

    /**
     * POST /auth/refresh — Issues a new access token from the cookie.
     * Called automatically by the base query reauth logic and on app init.
     */
    refresh: builder.mutation({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
    }),

    /**
     * GET /auth/me — Returns the current user's profile.
     */
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshMutation,
  useGetMeQuery,
} = authApi;
