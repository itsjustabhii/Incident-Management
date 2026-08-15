/**
 * @file Application route configuration
 * @description Defines all client-side routes using React Router v6.
 *
 * Security layering:
 *   1. AuthGuard — redirects unauthenticated users to /login.
 *   2. RoleGuard  — redirects authenticated users who lack the required role
 *                   to a 403 page (UX layer only — backend enforces the real gate).
 *
 * IMPORTANT: Frontend route protection is a UX convenience.
 * An authenticated user who manually navigates to /users will receive an API
 * 403 error from the server when the data loads — the page will be empty.
 * The route guard prevents that confusing experience by redirecting proactively.
 *
 * Real security: every API call is authorized server-side by the backend
 * middleware regardless of how the user navigated here.
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AuthGuard from '../components/auth/AuthGuard.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import PageLoader from '../components/feedback/PageLoader.jsx';
import { USER_ROLE } from '../constants/index.js';
import { selectCurrentRole } from '../features/auth/authSlice.js';

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
 * Wraps a route element with a role-based redirect.
 * If the user lacks the required role, they are redirected to the dashboard
 * instead of seeing a confusing empty page or error.
 *
 * UX layer only — backend still enforces authorization independently.
 *
 * @param {{ element: React.ReactNode, allowedRoles: string[] }} props
 */
function RoleRoute({ element, allowedRoles }) {
  // This component renders inside AuthGuard, so the user is always authenticated.
  // We read the role from Redux state (never from user-controlled input).
  const role = useSelector(selectCurrentRole);

  if (!role || !allowedRoles.includes(role)) {
    // Redirect to dashboard — user lacks the required role.
    // The server will return 403 if they somehow load data anyway.
    return <Navigate to="/dashboard" replace />;
  }

  return element;
}

/**
 * Root routes component.
 * All lazy-loaded pages are wrapped in Suspense with a PageLoader fallback.
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

          {/* All authenticated roles can access the dashboard */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* All authenticated roles can view incidents (scoped by server) */}
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />

          {/* VIEWERs cannot create incidents */}
          <Route
            path="incidents/new"
            element={
              <RoleRoute
                element={<CreateIncidentPage />}
                allowedRoles={[USER_ROLE.ADMIN, USER_ROLE.MANAGER, USER_ROLE.SUPPORT_ENGINEER]}
              />
            }
          />

          {/*
           * Users page — ADMIN and MANAGER only.
           * SUPPORT_ENGINEERs and VIEWERs cannot manage users.
           * UX redirect to dashboard; server will also return 403 on API calls.
           */}
          <Route
            path="users"
            element={
              <RoleRoute
                element={<UsersPage />}
                allowedRoles={[USER_ROLE.ADMIN, USER_ROLE.MANAGER]}
              />
            }
          />

          {/* Teams page — all authenticated roles can view teams */}
          <Route path="teams" element={<TeamsPage />} />

          {/* Profile page — all authenticated users */}
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
