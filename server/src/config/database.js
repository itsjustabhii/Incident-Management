/**
 * @file Prisma client singleton
 * @description Creates and exports a single PrismaClient instance.
 * Using a singleton prevents connection pool exhaustion during hot-reloads
 * in development (where the module may be re-imported multiple times).
 */

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Singleton Prisma instance used across the entire server.
 * Log level is tuned per environment:
 *   - development: log queries, warnings, and errors for debugging
 *   - production:  log only errors to reduce log volume
 */
const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

// In development, log Prisma query events to help detect N+1 issues
if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Prisma query');
  });
}

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

export default prisma;
