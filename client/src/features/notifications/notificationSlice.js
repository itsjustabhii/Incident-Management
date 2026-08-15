/**
 * @file Notifications RTK Query endpoints + Redux slice
 */

import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../store/api.js';

// ── RTK Query endpoints ────────────────────────────────────────────────────────
export const notificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** GET /notifications */
    getNotifications: builder.query({
      query: ({ page = 1, pageSize = 20 } = {}) =>
        `/notifications?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Notification'],
    }),

    /** PATCH /notifications/:id/read */
    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),

    /** PATCH /notifications/read-all */
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;

// ── Redux slice ───────────────────────────────────────────────────────────────
/**
 * Tracks the live unread notification count, updated by WebSocket events
 * so the badge in the navbar always reflects the real-time count.
 */
const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    unreadCount: 0,
    // Stack of newly arrived real-time notifications (for snackbar display)
    liveNotifications: [],
  },
  reducers: {
    /** Increments the unread badge when a new notification arrives via WebSocket */
    addLiveNotification(state, action) {
      state.unreadCount += 1;
      state.liveNotifications.push(action.payload);
    },
    /** Called after /notifications is fetched to sync the count with the server */
    setUnreadCount(state, action) {
      state.unreadCount = action.payload;
    },
    /** Dismisses a toast notification from the live stack */
    dismissLiveNotification(state, action) {
      state.liveNotifications = state.liveNotifications.filter(
        (n) => n.id !== action.payload,
      );
    },
  },
});

export const { addLiveNotification, setUnreadCount, dismissLiveNotification } =
  notificationSlice.actions;
export default notificationSlice.reducer;
