/**
 * @file SLA utility unit tests
 * @description Tests the SLA calculation functions in isolation.
 */

import {
  computeSlaBreachAt,
  getSlaStatus,
  adjustSlaForHold,
} from '../../src/utils/sla.js';

describe('computeSlaBreachAt', () => {
  it('computes CRITICAL breach time as 4 hours from start', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const breach = computeSlaBreachAt('CRITICAL', start);
    // CRITICAL default = 240 minutes = 4 hours
    const expectedMs = start.getTime() + 240 * 60 * 1000;
    expect(breach.getTime()).toBe(expectedMs);
  });

  it('throws for unknown priority', () => {
    expect(() => computeSlaBreachAt('UNKNOWN')).toThrow();
  });
});

describe('getSlaStatus', () => {
  it('returns ok when breach is in the future', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(getSlaStatus(future, 'OPEN', null)).toBe('ok');
  });

  it('returns breached when breach is in the past', () => {
    const past = new Date(Date.now() - 60 * 1000);
    expect(getSlaStatus(past, 'OPEN', null)).toBe('breached');
  });

  it('returns ok when resolved before breach', () => {
    const breach = new Date(Date.now() + 60 * 60 * 1000);
    const resolved = new Date(Date.now() - 10 * 60 * 1000);
    expect(getSlaStatus(breach, 'RESOLVED', resolved)).toBe('ok');
  });
});

describe('adjustSlaForHold', () => {
  it('extends breach deadline by the hold duration', () => {
    const breach = new Date('2024-01-01T12:00:00Z');
    const holdStart = new Date(Date.now() - 30 * 60 * 1000); // held for 30 mins
    const adjusted = adjustSlaForHold(breach, holdStart);
    // Adjusted breach should be ~30 minutes after the original
    const diff = adjusted.getTime() - breach.getTime();
    expect(diff).toBeGreaterThanOrEqual(29 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(31 * 60 * 1000);
  });
});
