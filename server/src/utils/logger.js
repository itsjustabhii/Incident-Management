/**
 * @file Structured application logger
 * @description Creates a pino logger instance configured for the current
 * environment. Uses pretty-printing in development for human readability and
 * JSON output in production for log aggregation pipelines (Datadog, CloudWatch).
 */

import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Pino logger singleton.
 * All application code should import and use this logger rather than
 * calling console.log/warn/error directly — it includes structured context
 * (timestamps, log levels, correlation IDs) that plain console calls lack.
 *
 * Usage:
 *   logger.info('Server started');
 *   logger.error({ err, userId }, 'Failed to fetch incident');
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  // Use pino-pretty transport in non-production for coloured, readable output
  transport:
    env.LOG_FORMAT === 'pretty'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // In JSON mode, standard fields make logs easier to parse
  base: env.LOG_FORMAT === 'json' ? { service: 'incident-api', version: '1.0.0' } : undefined,
  // Redact sensitive fields that must never appear in logs
  redact: {
    paths: ['req.headers.authorization', 'body.password', 'body.currentPassword', 'body.newPassword'],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
