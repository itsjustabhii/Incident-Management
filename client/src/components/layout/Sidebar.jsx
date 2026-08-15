/**
 * @file Sidebar navigation component
 * @description Collapsible sidebar with navigation links.
 * Highlights the active route and supports keyboard navigation.
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BugReportIcon from '@mui/icons-material/BugReport';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import { toggleSidebar } from '../../store/uiSlice.js';
import { selectCurrentUser } from '../../features/auth/authSlice.js';
import { USER_ROLE } from '../../constants/index.js';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Incidents', icon: <BugReportIcon />, path: '/incidents' },
  { label: 'Users', icon: <PeopleIcon />, path: '/users', roles: [USER_ROLE.ADMIN, USER_ROLE.MANAGER] },
  { label: 'Teams', icon: <GroupsIcon />, path: '/teams', roles: [USER_ROLE.ADMIN, USER_ROLE.MANAGER] },
];

/**
 * Collapsible navigation sidebar.
 * Role-restricted items are hidden from users without the required role.
 *
 * @param {{ width: number, collapsedWidth: number }} props
 */
function Sidebar({ width, collapsedWidth }) {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const currentUser = useSelector(selectCurrentUser);
  const currentWidth = sidebarOpen ? width : collapsedWidth;

  /** Filters nav items based on the current user's role */
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentUser?.role),
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
          bgcolor: 'primary.dark',
          color: 'white',
        },
      }}
    >
      {/* App logo / brand area */}
      <Box sx={{ p: 2, height: 64, display: 'flex', alignItems: 'center' }}>
        {sidebarOpen && (
          <Typography variant="h6" fontWeight={700} color="white" noWrap>
            IncidentHub
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      <List component="nav" aria-label="Main navigation">
        {visibleItems.map((item) => (
          <Tooltip
            key={item.path}
            title={sidebarOpen ? '' : item.label}
            placement="right"
          >
            <ListItemButton
              component={NavLink}
              to={item.path}
              aria-label={item.label}
              sx={{
                color: 'rgba(255,255,255,0.7)',
                '&.active': { color: 'white', bgcolor: 'rgba(255,255,255,0.12)' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
                minHeight: 48,
                justifyContent: sidebarOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{ color: 'inherit', minWidth: 0, mr: sidebarOpen ? 2 : 'auto' }}
              >
                {item.icon}
              </ListItemIcon>
              {sidebarOpen && <ListItemText primary={item.label} />}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
    </Drawer>
  );
}

export default Sidebar;
