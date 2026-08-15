/**
 * @file AuthGuard component
 * @description Protects routes that require authentication.
 * While the app is restoring session state (isInitializing), shows a
 * full-screen loader to prevent a flash of the login page for users
 * who have a valid refresh token cookie.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  selectIsAuthenticated,
  selectIsInitializing,
} from '../../features/auth/authSlice.js';
import PageLoader from '../feedback/PageLoader.jsx';

/**
 * Wraps child routes and enforces authentication.
 * Saves the attempted URL in router state so the user is redirected back
 * after a successful login rather than always going to the dashboard.
 *
 * @param {{ children: React.ReactNode }} props
 */
function AuthGuard({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitializing = useSelector(selectIsInitializing);
  const location = useLocation();

  // Show loader while the app checks for an existing session on first render
  if (isInitializing) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    // Pass the attempted location so login can redirect back after success
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default AuthGuard;
