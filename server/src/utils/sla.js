/**
 * @file SLA calculation utilities
 * @description Computes SLA breach timestamps and determines SLA status for
 * incidents. SLA calculations are centralised here so the same logic is shared
 * between the incident service, the SLA monitor job, and the dashboard queries.
 *
 * SLA defaults are read from environment variables at call time (not at import
 * time) so this module can be safely imported in test environments where the
 * full env validation may not have run.
 */

import { INCIDENT_PRIORITY } from '../constants/incident.js';

/**
 * Returns the SLA resolution time in minutes for a given priority.
 * Reads from process.env at call time so tests can run without a full
 * env validation boot.
 *
 * @param {string} priority
 * @returns {number} Resolution SLA in minutes
 */
function getSlaResolutionMinutes(priority) {
  const defaults = {
    [INCIDENT_PRIORITY.CRITICAL]: 240,
    [INCIDENT_PRIORITY.HIGH]: 480,
    [INCIDENT_PRIORITY.MEDIUM]: 1440,
    [INCIDENT_PRIORITY.LOW]: 4320,
  };
  const envKey = `SLA_${priority}_RESOLUTION_MINUTES`;
  return parseInt(process.env[envKey], 10) || defaults[priority];
}

/**
 * Returns the SLA first-response time in minutes for a given priority.
 * @param {string} priority
 * @returns {number}
 */
function getSlaResponseMinutes(priority) {
  const defaults = {
    [INCIDENT_PRIORITY.CRITICAL]: 60,
    [INCIDENT_PRIORITY.HIGH]: 240,
    [INCIDENT_PRIORITY.MEDIUM]: 480,
    [INCIDENT_PRIORITY.LOW]: 1440,
  };
  const envKey = `SLA_${priority}_RESPONSE_MINUTES`;
  return parseInt(process.env[envKey], 10) || defaults[priority];
}

/**
 * Computes the absolute Date at which an incident's SLA will breach
 * if it is not resolved.
 *
 * @param {string} priority - Incident priority (CRITICAL | HIGH | MEDIUM | LOW)
 * @param {Date} [startTime=new Date()] - The clock start time (defaults to now)
 * @returns {Date} The datetime at which the resolution SLA breaches
 */
export function computeSlaBreachAt(priority, startTime = new Date()) {
  const minutes = getSlaResolutionMinutes(priority);
  if (!minutes) {
    throw new Error(`Unknown priority '${priority}' — cannot compute SLA breach time`);
  }
  return new Date(startTime.getTime() + minutes * 60 * 1000);
}

/**
 * Computes the absolute Date at which the first-response SLA breaches.
 *
 * @param {string} priority - Incident priority
 * @param {Date} [startTime=new Date()] - Clock start time
 * @returns {Date} The datetime at which the response SLA breaches
 */
export function computeResponseSlaBreachAt(priority, startTime = new Date()) {
  const minutes = getSlaResponseMinutes(priority);
  if (!minutes) {
    throw new Error(`Unknown priority '${priority}' — cannot compute response SLA breach time`);
  }
  return new Date(startTime.getTime() + minutes * 60 * 1000);
}

/**
 * Determines the SLA status of an incident.
 *
 * @param {Date|null} slaBreachAt - The SLA breach deadline
 * @param {string} status - Current incident status
 * @param {Date|null} resolvedAt - When the incident was resolved (if at all)
 * @returns {'ok' | 'at_risk' | 'breached'} SLA status string
 */
export function getSlaStatus(slaBreachAt, status, resolvedAt) {
  if (!slaBreachAt) return 'ok';

  const isResolved = status === 'RESOLVED' || status === 'CLOSED';

  // If resolved, check whether resolution happened before or after the SLA deadline
  if (isResolved && resolvedAt) {
    return resolvedAt <= slaBreachAt ? 'ok' : 'breached';
  }

  const now = new Date();

  if (now >= slaBreachAt) return 'breached';

  // Warn when within 20% of the SLA window remaining — helps teams act proactively
  const totalWindow = slaBreachAt - (resolvedAt || now);
  const remaining = slaBreachAt - now;
  const percentRemaining = remaining / (totalWindow || 1);

  if (percentRemaining <= 0.2) return 'at_risk';

  return 'ok';
}

/**
 * Adjusts the SLA breach timestamp when an incident is put ON_HOLD
 * by adding the hold duration to the breach deadline, effectively pausing
 * the SLA clock for the period the incident was paused.
 *
 * @param {Date} currentBreachAt - Current SLA breach deadline
 * @param {Date} holdStartedAt - When the ON_HOLD status was set
 * @returns {Date} Adjusted SLA breach deadline
 */
export function adjustSlaForHold(currentBreachAt, holdStartedAt) {
  const holdDurationMs = Date.now() - holdStartedAt.getTime();
  return new Date(currentBreachAt.getTime() + holdDurationMs);
}
