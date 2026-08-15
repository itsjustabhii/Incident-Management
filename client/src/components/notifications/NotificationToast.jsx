/**
 * @file NotificationToast component
 * @description Displays real-time WebSocket notifications as MUI Snackbar alerts.
 * Subscribes to the Redux live notification stack and shows each one in sequence.
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Snackbar, Alert } from '@mui/material';
import { dismissLiveNotification } from '../../features/notifications/notificationSlice.js';

/**
 * Renders the most recent unread live notification as a snackbar.
 * Auto-hides after 6 seconds; user can also manually dismiss.
 */
function NotificationToast() {
  const dispatch = useDispatch();
  const liveNotifications = useSelector((s) => s.notifications.liveNotifications);

  // Show only the first notification in the stack; once dismissed, the next appears
  const current = liveNotifications[0];

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    if (current) dispatch(dismissLiveNotification(current.id));
  };

  return (
    <Snackbar
      open={Boolean(current)}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {current && (
        <Alert
          severity="info"
          onClose={handleClose}
          variant="filled"
          sx={{ width: '100%', maxWidth: 400 }}
        >
          <strong>{current.title}</strong>
          <br />
          {current.body}
        </Alert>
      )}
    </Snackbar>
  );
}

export default NotificationToast;
