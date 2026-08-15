/**
 * @file Client-side application constants
 * @description Mirrors the server-side constants used in the UI.
 * Centralising these prevents magic strings in components.
 */

export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

export const INCIDENT_PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const INCIDENT_CATEGORY = Object.freeze({
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  APPLICATION: 'APPLICATION',
  SECURITY: 'SECURITY',
  NETWORK: 'NETWORK',
  DATABASE: 'DATABASE',
  PERFORMANCE: 'PERFORMANCE',
  OTHER: 'OTHER',
});

export const USER_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  ENGINEER: 'ENGINEER',
  VIEWER: 'VIEWER',
});

/** Maps incident status to MUI colour tokens for badge rendering */
export const STATUS_COLOUR = Object.freeze({
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  ON_HOLD: 'default',
  RESOLVED: 'success',
  CLOSED: 'default',
});

/** Maps incident priority to MUI colour tokens */
export const PRIORITY_COLOUR = Object.freeze({
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'success',
});
