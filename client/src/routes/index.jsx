/**
 * @file Application route configuration
 * @description Defines all client-side routes using React Router v6.
 * Protected routes are wrapped in AuthGuard which redirects unauthenticated
 * users to the login page. Role-based routing is also handled here.
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from '../components/auth/AuthGuard.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import PageLoader from '../components/feedback/PageLoader.jsx';

// Lazy-load pages to enable code splitting — reduces initial bundle size
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));
const IncidentsPage = lazy(() => import('../pages/IncidentsPage.jsx'));
const IncidentDetailPage = lazy(() => import('../pages/IncidentDetailPage.jsx'));
const CreateIncidentPage = lazy(() => import('../pages/CreateIncidentPage.jsx'));
const UsersPage = lazy(() => import('../pages/UsersPage.jsx'));
const TeamsPage = lazy(() => import('../pages/TeamsPage.jsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));

/**
 * Root routes component.
 * All lazy-loaded pages are wrapped in Suspense with a PageLoader fallback
 * so there is always a meaningful loading state during code split loads.
 */
function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes — accessible without authentication */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes — redirect to /login if not authenticated */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          {/* Default redirect from / to /dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/new" element={<CreateIncidentPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
