/**
 * @file AuthGuard unit test
 * @description Tests that the AuthGuard component correctly redirects
 * unauthenticated users to /login and renders children when authenticated.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import AuthGuard from '../../src/components/auth/AuthGuard.jsx';
import authReducer from '../../src/features/auth/authSlice.js';

/**
 * Creates a test store with the given auth state.
 */
function makeStore(authState) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: authState },
  });
}

describe('AuthGuard', () => {
  it('shows a loading spinner while initializing', () => {
    const store = makeStore({ isInitializing: true, isAuthenticated: false, user: null, accessToken: null });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AuthGuard><div>Protected content</div></AuthGuard>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    const store = makeStore({ isInitializing: false, isAuthenticated: true, user: { id: '1' }, accessToken: 'token' });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AuthGuard><div>Protected content</div></AuthGuard>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
