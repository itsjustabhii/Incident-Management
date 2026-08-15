/**
 * @file PageLoader component
 * @description Full-screen loading indicator shown during route lazy-loading
 * and session initialization. Accessible via aria-busy and role="status".
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Centered full-page loading spinner.
 * Used as the Suspense fallback and during auth initialization.
 */
function PageLoader({ message = 'Loading…' }) {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={message}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

export default PageLoader;
