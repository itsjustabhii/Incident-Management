/**
 * @file WebSocket server
 * @description Initialises the Socket.IO server, attaches JWT authentication
 * middleware, and registers event handlers for real-time incident updates
 * and per-user notifications.
 *
 * Two namespaces are used:
 *   /incidents     — Room-based broadcasts for incident updates
 *   /notifications — Personal channels for per-user notifications
 */

import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env, corsOrigins } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Socket.IO server instance — exported so services can emit events directly.
 * @type {import('socket.io').Server | null}
 */
let io = null;

/**
 * Initialises Socket.IO and attaches it to the provided HTTP server.
 * Sets up JWT auth middleware on all namespaces and registers event handlers.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance
 * @returns {import('socket.io').Server} Configured Socket.IO server
 */
export function initSocketIO(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Prefer WebSocket; fall back to long-polling for clients behind strict proxies
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // ── Global auth middleware ─────────────────────────────────────────────────
  /**
   * Verifies the JWT token sent in socket.handshake.auth.token before
   * allowing any socket connection. Unauthenticated connections are rejected
   * immediately rather than waiting for a later event.
   */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required — no token provided'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      // Attach user data to the socket so handlers can use it without re-verifying
      socket.data.userId = decoded.sub;
      socket.data.role = decoded.role;
      socket.data.email = decoded.email;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── /incidents namespace ───────────────────────────────────────────────────
  const incidentNs = io.of('/incidents');

  incidentNs.on('connection', (socket) => {
    logger.debug(
      { userId: socket.data.userId, socketId: socket.id },
      'Socket connected to /incidents',
    );

    /**
     * Joins the socket to a room scoped to a specific incident.
     * All clients viewing the same incident receive real-time updates.
     */
    socket.on('join_incident', ({ incidentId }) => {
      if (!incidentId) return;
      socket.join(`incident:${incidentId}`);
      logger.debug({ userId: socket.data.userId, incidentId }, 'Joined incident room');
    });

    /**
     * Removes the socket from a specific incident room when the user
     * navigates away from the incident detail page.
     */
    socket.on('leave_incident', ({ incidentId }) => {
      if (!incidentId) return;
      socket.leave(`incident:${incidentId}`);
      logger.debug({ userId: socket.data.userId, incidentId }, 'Left incident room');
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.data.userId, reason }, 'Socket disconnected from /incidents');
    });
  });

  // ── /notifications namespace ───────────────────────────────────────────────
  const notificationNs = io.of('/notifications');

  notificationNs.on('connection', (socket) => {
    // Each user automatically joins their personal notification room
    socket.join(`user:${socket.data.userId}`);
    logger.debug(
      { userId: socket.data.userId, socketId: socket.id },
      'Socket connected to /notifications',
    );

    socket.on('disconnect', (reason) => {
      logger.debug(
        { userId: socket.data.userId, reason },
        'Socket disconnected from /notifications',
      );
    });
  });

  logger.info('Socket.IO server initialised (namespaces: /incidents, /notifications)');
  return io;
}

/**
 * Returns the Socket.IO server instance.
 * Services call this to emit events without needing to import the HTTP server.
 *
 * @returns {import('socket.io').Server}
 * @throws {Error} If called before initSocketIO()
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialised — call initSocketIO() first');
  }
  return io;
}

// ── Emit helpers ──────────────────────────────────────────────────────────────
// These helpers are called from service layer to broadcast events without
// the service needing to know about Socket.IO internals.

/**
 * Broadcasts an incident update to all sockets in the incident's room.
 * @param {string} incidentId - The incident whose room receives the update
 * @param {string} event - Socket event name (e.g., 'incident_updated')
 * @param {object} payload - The event payload
 */
export function emitToIncident(incidentId, event, payload) {
  if (!io) return;
  io.of('/incidents').to(`incident:${incidentId}`).emit(event, payload);
}

/**
 * Sends a notification event to a specific user's personal channel.
 * @param {string} userId - The recipient user's ID
 * @param {object} notification - The notification payload
 */
export function emitNotificationToUser(userId, notification) {
  if (!io) return;
  io.of('/notifications').to(`user:${userId}`).emit('notification', notification);
}

/**
 * Broadcasts an event to all connected sockets (e.g., system-wide announcements).
 * @param {string} event - Socket event name
 * @param {object} payload - The event payload
 */
export function emitBroadcast(event, payload) {
  if (!io) return;
  io.of('/incidents').emit(event, payload);
}
