/**
 * @file Incident domain constants
 * @description Enumerations for incident status, priority, and category.
 * Using string constants (rather than magic strings) throughout the codebase
 * ensures that typos are caught at development time and that renaming a value
 * requires only a single change here.
 */

/** All valid incident lifecycle statuses */
export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

/** Allowed status transitions — enforces the incident state machine */
export const VALID_STATUS_TRANSITIONS = Object.freeze({
  OPEN: ['IN_PROGRESS', 'ON_HOLD', 'CLOSED'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'CLOSED'],
  ON_HOLD: ['IN_PROGRESS', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'], // Can be re-opened
  CLOSED: [], // Terminal state — no transitions allowed
});

/** All valid incident priorities */
export const INCIDENT_PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

/** All valid incident categories */
export const INCIDENT_CATEGORY = Object.freeze({
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  APPLICATION: 'APPLICATION',
  SECURITY: 'SECURITY',
  NETWORK: 'NETWORK',
  DATABASE: 'DATABASE',
  PERFORMANCE: 'PERFORMANCE',
  OTHER: 'OTHER',
});

/** Human-readable SLA status labels */
export const SLA_STATUS = Object.freeze({
  OK: 'ok',
  AT_RISK: 'at_risk',
  BREACHED: 'breached',
});
