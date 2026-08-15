/**
 * @file AppLayout component
 * @description The main authenticated layout shell containing the top
 * navigation bar, collapsible sidebar, and the main content area.
 * Child routes render inside the <Outlet /> component.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSelector } from 'react-redux';
import Sidebar from '../components/layout/Sidebar.jsx';
import Topbar from '../components/layout/Topbar.jsx';
import SocketProvider from '../components/providers/SocketProvider.jsx';
import NotificationToast from '../components/notifications/NotificationToast.jsx';

const SIDEBAR_WIDTH = 240;
const COLLAPSED_SIDEBAR_WIDTH = 72;

/**
 * Main application layout.
 * Sidebar width adapts based on the open/collapsed state in Redux.
 */
function AppLayout() {
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const effectiveSidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH;

  return (
    // SocketProvider initialises the Socket.IO connection and keeps it alive
    // for the duration of the authenticated session
    <SocketProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Navigation sidebar — persists across route changes */}
        <Sidebar width={SIDEBAR_WIDTH} collapsedWidth={COLLAPSED_SIDEBAR_WIDTH} />

        {/* Main content area — offset by sidebar width */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: `${effectiveSidebarWidth}px`,
            transition: 'margin 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
          }}
        >
          <Topbar />
          {/* Page content rendered by React Router nested routes */}
          <Box sx={{ flexGrow: 1, p: 3 }}>
            <Outlet />
          </Box>
        </Box>
      </Box>

      {/* Toast notifications for real-time WebSocket events */}
      <NotificationToast />
    </SocketProvider>
  );
}

export default AppLayout;
