/**
 * @file Jest test globals
 * @description Sets required environment variables BEFORE any test modules
 * are imported. Jest's globalSetup runs in a separate process, so we use
 * a setupFiles script (which runs in the same process) to set process.env
 * before the app modules import config/env.js.
 */

// These must be set before any app module is imported
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Provide placeholder values for required env vars so env.js validation passes
// Real database credentials would be set in .env.test in a real environment
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/incident_test';
}
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters-long-for-validation';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters-long-for-validation';
}
