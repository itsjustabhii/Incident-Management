/**
 * @file UI state slice
 * @description Manages application-level UI state that doesn't belong to
 * any specific feature (sidebar open/closed, global loading overlay, etc.).
 */

import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    globalLoading: false,
  },
  reducers: {
    /** Toggles the navigation sidebar open/closed */
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    /** Sets the sidebar open state explicitly */
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload;
    },
    /** Shows or hides the full-screen loading overlay */
    setGlobalLoading(state, action) {
      state.globalLoading = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;
