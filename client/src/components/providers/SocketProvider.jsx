/**
 * @file SocketProvider component
 * @description Initialises the Socket.IO connection via the useSocket hook
 * and makes it available through a React context so any child component
 * can access the socket without prop drilling.
 */

import React, { createContext, useContext } from 'react';
import { useSocket } from '../../hooks/useSocket.js';

const SocketContext = createContext(null);

/**
 * Returns the Socket.IO socket instances from context.
 * @returns {{ incidentSocket: Socket|null, notificationSocket: Socket|null }}
 */
export function useSocketContext() {
  return useContext(SocketContext);
}

/**
 * Wraps the authenticated layout to maintain a single Socket.IO connection
 * for the duration of the user's session.
 */
function SocketProvider({ children }) {
  const sockets = useSocket();
  return <SocketContext.Provider value={sockets}>{children}</SocketContext.Provider>;
}

export default SocketProvider;
