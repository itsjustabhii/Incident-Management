/**
 * @file Health endpoint integration tests
 * @description Verifies the health check endpoints return correct status codes
 * and shapes without requiring a real DB/Redis connection.
 */

import request from 'supertest';
import app from '../../src/app.js';

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns either 200 or 503 (depends on test DB availability)', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
