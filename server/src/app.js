/**
 * @file Express application factory
 * @description Configures and exports the Express app with all global middleware,
 * route registrations, and error handlers. The HTTP server and Socket.IO
 * initialisation happen in server.js so this module stays testable in isolation
 * (Supertest can import the app without binding to a port).
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { corsOrigins } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// ── Route imports ─────────────────────────────────────────────────────────────
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import incidentRouter from './routes/incidents.js';
import commentRouter from './routes/comments.js';
import attachmentRouter from './routes/attachments.js';
import userRouter from './routes/users.js';
import teamRouter from './routes/teams.js';
import notificationRouter from './routes/notifications.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// Helmet sets sensible HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow only the configured origins so browsers enforce the same-origin policy
app.use(
  cors({
    origin: corsOrigins,
    credentials: true, // Required for HttpOnly cookie refresh tokens
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Compression ───────────────────────────────────────────────────────────────
// Gzip response bodies to reduce bandwidth — especially valuable for list responses
app.use(compression());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' })); // JSON bodies capped at 1MB
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser()); // Required to read the refresh token HttpOnly cookie

// ── HTTP request logging ──────────────────────────────────────────────────────
// Use a stream adapter so Morgan feeds into the pino logger instead of stdout
const morganStream = {
  write: (message) => logger.info({ type: 'http' }, message.trimEnd()),
};
app.use(morgan('combined', { stream: morganStream }));

// ── Trust proxy ───────────────────────────────────────────────────────────────
// Required so express-rate-limit reads the real client IP from X-Forwarded-For
// when running behind nginx or a cloud load balancer
app.set('trust proxy', 1);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Apply the general rate limiter to all API routes
app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/incidents', incidentRouter);
app.use('/api/v1/incidents', commentRouter);      // Nested: /incidents/:id/comments
app.use('/api/v1/incidents', attachmentRouter);   // Nested: /incidents/:id/attachments
app.use('/api/v1/users', userRouter);
app.use('/api/v1/teams', teamRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/dashboard', dashboardRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
// Catches any request that did not match a registered route
app.use(notFoundHandler);

// ── Centralized error handler ─────────────────────────────────────────────────
// MUST be registered last — Express recognises 4-arg middleware as error handlers
app.use(errorHandler);

export default app;
