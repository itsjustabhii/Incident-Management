/**
 * @file RoleGuard component
 * @description A UX-layer component that conditionally renders children based on
 * the current user's role or permission.
 *
 * IMPORTANT SECURITY NOTE:
 * This component is a UX convenience only — it hides UI elements that the current
 * user should not see based on their role. It is NOT a security boundary.
 * An attacker can bypass this by manipulating the DOM or Redux state.
 * Every action guarded here MUST ALSO be independently authorized on the backend.
 *
 * Usage patterns:
 *
 * 1. Role allowlist — show only to specific roles:
 *    <RoleGuard roles={['ADMIN', 'MANAGER']}>
 *      <AdminPanel />
 *    </RoleGuard>
 *
 * 2. Permission check — show only if role has a named permission:
 *    <RoleGuard permission={PERMISSION.ASSIGN_INCIDENTS}>
 *      <AssignButton />
 *    </RoleGuard>
 *
 * 3. Fallback content — render something else for unauthorized users:
 *    <RoleGuard roles={['ADMIN']} fallback={<ViewOnlyBanner />}>
 *      <EditForm />
 *    </RoleGuard>
 */

import { useSelector } from 'react-redux';
import { selectCurrentRole } from '../../features/auth/authSlice.js';
import { hasPermission } from '../../constants/permissions.js';

/**
 * Role/permission guard for UI elements.
 * Renders children if the user's role satisfies the guard condition.
 * Renders `fallback` (default: null) otherwise.
 *
 * At least one of `roles` or `permission` must be provided.
 *
 * @param {{ roles?: string[], permission?: string, fallback?: React.ReactNode, children: React.ReactNode }} props
 */
function RoleGuard({ roles, permission, fallback = null, children }) {
  const role = useSelector(selectCurrentRole);

  // No authenticated user — never render the guarded content
  if (!role) return fallback;

  let isAuthorized = false;

  if (permission) {
    // Permission-based check — the role has this named permission
    isAuthorized = hasPermission(role, permission);
  } else if (roles && roles.length > 0) {
    // Role allowlist check — the role is in the explicit allowlist
    isAuthorized = roles.includes(role);
  } else {
    // No constraint specified — show to all authenticated users
    isAuthorized = true;
  }

  return isAuthorized ? children : fallback;
}

export default RoleGuard;
