/**
 * @file Topbar component
 * @description Top application bar with sidebar toggle, page title,
 * notification bell, and user avatar menu.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Box,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { toggleSidebar } from '../../store/uiSlice.js';
import { selectCurrentUser, logout as logoutAction } from '../../features/auth/authSlice.js';
import { useLogoutMutation } from '../../features/auth/authApi.js';
import { api } from '../../store/api.js';

/**
 * Application top bar.
 * Shows notification badge count from Redux (updated by WebSocket events).
 */
function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);
  const unreadCount = useSelector((state) => state.notifications.unreadCount);

  const [anchorEl, setAnchorEl] = useState(null);
  const [logoutMutation] = useLogoutMutation();

  /** Handles user menu logout — calls API, clears Redux, redirects to login */
  const handleLogout = async () => {
    try {
      await logoutMutation();
    } finally {
      // Clear Redux state regardless of API response
      dispatch(logoutAction());
      // Reset all RTK Query cache so previous user's data is not leaked
      dispatch(api.util.resetApiState());
      navigate('/login');
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar>
        {/* Sidebar toggle button */}
        <IconButton
          edge="start"
          aria-label="Toggle navigation sidebar"
          onClick={() => dispatch(toggleSidebar())}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Flexible spacer pushes the user actions to the right */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Notification bell with unread count badge */}
        <Tooltip title="Notifications">
          <IconButton
            aria-label={`${unreadCount} unread notifications`}
            onClick={() => navigate('/notifications')}
          >
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* User avatar menu */}
        <Tooltip title={currentUser?.displayName || 'Account'}>
          <IconButton
            aria-label="Open user menu"
            aria-haspopup="true"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ ml: 1 }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              {currentUser?.displayName?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => { setAnchorEl(null); navigate('/profile'); }}
          >
            My Profile
          </MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default Topbar;
