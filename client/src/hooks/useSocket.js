/**
 * @file useSocket custom hook
 * @description Creates and manages a Socket.IO client connection.
 * The connection is established once when the user authenticates and
 * torn down on logout. The hook returns the socket instance so components
 * can register event listeners.
 */

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { selectAccessToken, selectIsAuthenticated } from '../features/auth/authSlice.js';
import { addLiveNotification } from '../features/notifications/notificationSlice.js';

/**
 * Manages the Socket.IO connection lifecycle.
 * Returns a ref to the incidents namespace socket.
 *
 * Connection is only created when the user is authenticated.
 * On access token change (refresh), the existing socket is disconnected
 * and a new authenticated connection is made.
 *
 * @returns {{ incidentSocket: Socket|null, notificationSocket: Socket|null }}
 */
export function useSocket() {
  const accessToken = useSelector(selectAccessToken);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const dispatch = useDispatch();

  const incidentSocketRef = useRef(null);
  const notificationSocketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Disconnect if no longer authenticated
      incidentSocketRef.current?.disconnect();
      notificationSocketRef.current?.disconnect();
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || '';
    const socketOptions = {
      auth: { token: accessToken }, // JWT sent in the socket handshake for server-side auth
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    };

    // Connect to the incidents namespace for real-time incident updates
    incidentSocketRef.current = io(`${wsUrl}/incidents`, socketOptions);

    // Connect to the notifications namespace for personal notifications
    notificationSocketRef.current = io(`${wsUrl}/notifications`, socketOptions);

    /**
     * When a notification arrives via WebSocket, dispatch it to Redux so:
     * 1. The unread badge count increments
     * 2. A toast snackbar is shown
     */
    notificationSocketRef.current.on('notification', (notification) => {
      dispatch(addLiveNotification(notification));
    });

    return () => {
      // Clean up socket connections when the component unmounts or auth changes
      incidentSocketRef.current?.disconnect();
      notificationSocketRef.current?.disconnect();
    };
  }, [isAuthenticated, accessToken, dispatch]);

  return {
    incidentSocket: incidentSocketRef.current,
    notificationSocket: notificationSocketRef.current,
  };
}
