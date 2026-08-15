/**
 * @file Root application component
 * @description Sets up the route configuration and wraps the app in global
 * providers (auth guard, socket connection initialiser, toast container).
 * Kept minimal — actual layout and page rendering live in routes/index.jsx.
 */

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import AppRoutes from './routes/index.jsx';
import { initializeAuth } from './features/auth/authSlice.js';

/**
 * Root App component.
 * On mount, attempts to restore authentication state from the persisted
 * access token stored in memory. This re-validates the user's session
 * after a page refresh without requiring a full re-login.
 */
function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Attempt to restore the session by calling the /auth/refresh endpoint
    // using the HttpOnly cookie. If it fails, the user is treated as logged out.
    dispatch(initializeAuth());
  }, [dispatch]);

  return <AppRoutes />;
}

export default App;
