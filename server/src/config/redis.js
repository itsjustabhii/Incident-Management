/**
 * @file Redis client configuration
 * @description Creates and exports an ioredis client and a dedicated pub/sub
 * subscriber client.
 *
 * Two separate clients are required because a Redis connection in subscriber
 * mode cannot be used for regular commands — it is exclusively reserved for
 * receiving published messages.
 */

import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Builds the ioredis connection options from environment variables.
 * Prefers REDIS_URL if provided (common on PaaS platforms); falls back
 * to individual host/port/password fields.
 *
 * @returns {import('ioredis').RedisOptions} ioredis connection options
 */
function buildRedisOptions() {
  const baseOptions = {
    // Automatically reconnect with exponential backoff capped at 10 seconds
    retryStrategy(times) {
      const delay = Math.min(times * 200, 10000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
      return delay;
    },
    // Emit an error instead of throwing when a command is sent before connect
    enableOfflineQueue: true,
    lazyConnect: false,
  };

  if (env.REDIS_URL) {
    return { ...baseOptions };
  }

  return {
    ...baseOptions,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  };
}

/**
 * Creates a new ioredis client and attaches standard event listeners for
 * logging and monitoring.
 *
 * @param {string} label - Human-readable label used in log messages
 * @returns {import('ioredis').Redis} Configured Redis client
 */
function createRedisClient(label) {
  const client = env.REDIS_URL ? new Redis(env.REDIS_URL, buildRedisOptions()) : new Redis(buildRedisOptions());

  client.on('connect', () => logger.info({ client: label }, 'Redis connected'));
  client.on('ready', () => logger.info({ client: label }, 'Redis ready'));
  client.on('error', (err) => logger.error({ client: label, err }, 'Redis error'));
  client.on('close', () => logger.warn({ client: label }, 'Redis connection closed'));
  client.on('reconnecting', () => logger.warn({ client: label }, 'Redis reconnecting'));

  return client;
}

/**
 * Primary Redis client — used for all read/write/cache operations.
 * Must NOT be used for SUBSCRIBE/PSUBSCRIBE commands.
 */
export const redis = createRedisClient('primary');

/**
 * Dedicated subscriber client — used only for Pub/Sub subscriptions.
 * Kept separate from the primary client so normal commands are unaffected.
 */
export const redisSub = createRedisClient('subscriber');

/**
 * Gracefully disconnects both Redis clients.
 * Called during server shutdown to ensure clean process exit.
 */
export async function disconnectRedis() {
  await redis.quit();
  await redisSub.quit();
  logger.info('Redis clients disconnected');
}
