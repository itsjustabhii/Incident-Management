/**
 * @file Server entry point
 * @description Creates the HTTP server, initialises Socket.IO, connects to
 * PostgreSQL and Redis, starts background jobs, then begins listening for
 * incoming connections.
 *
 * Separation from app.js ensures the Express app can be imported by tests
 * (via Supertest) without binding to a port or starting background processes.
 */

import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import prisma from './config/database.js';
import { redis, disconnectRedis } from './config/redis.js';
import { initSocketIO } from './websocket/socket.js';
import { startSlaMonitor } from './jobs/slaMonitor.js';

// Create a raw Node.js HTTP server wrapping the Express app so Socket.IO
// can share the same port as the REST API
const httpServer = http.createServer(app);

// Attach Socket.IO to the HTTP server
initSocketIO(httpServer);

/**
 * Performs startup health checks to verify that all required external services
 * are reachable before accepting traffic. Exits the process if any check fails
 * so that the container restarts and the orchestrator can retry.
 */
async function checkConnections() {
  // Verify PostgreSQL connectivity with a cheap query
  await prisma.$queryRaw`SELECT 1`;
  logger.info('PostgreSQL connection verified');

  // Verify Redis connectivity
  await redis.ping();
  logger.info('Redis connection verified');
}

/**
 * Starts the HTTP server and all background services.
 * Called once at startup — errors are fatal.
 */
async function startServer() {
  try {
    await checkConnections();

    // Start the SLA breach monitor cron job (runs every minute)
    startSlaMonitor();

    httpServer.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
      logger.info(
        {
          port: env.SERVER_PORT,
          host: env.SERVER_HOST,
          env: env.NODE_ENV,
        },
        `🚀  Incident Management API running on http://${env.SERVER_HOST}:${env.SERVER_PORT}`,
      );
    });
  } catch (err) {
    logger.fatal({ err }, 'Fatal startup error — server cannot start');
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
/**
 * Performs a graceful shutdown on SIGTERM / SIGINT signals.
 * Stops accepting new connections, closes existing ones, disconnects from
 * databases, and exits cleanly. This ensures Docker stop / Kubernetes pod
 * termination does not kill in-flight requests.
 */
async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — starting graceful shutdown');

  httpServer.close(async () => {
    logger.info('HTTP server closed — no new connections accepted');
    try {
      await prisma.$disconnect();
      logger.info('PostgreSQL disconnected');
      await disconnectRedis();
      logger.info('Redis disconnected');
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes more than 30 seconds
  setTimeout(() => {
    logger.error('Shutdown timeout — forcing exit');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Log unhandled rejections rather than crashing silently
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — initiating shutdown');
  shutdown('uncaughtException');
});

startServer();
