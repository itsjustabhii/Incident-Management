/**
 * @file 404 Not Found page
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';

function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Typography variant="h1" fontWeight={700} color="text.secondary">404</Typography>
      <Typography variant="h5">Page not found</Typography>
      <Typography color="text.secondary">The page you're looking for doesn't exist.</Typography>
      <Button component={Link} to="/dashboard" variant="contained">Go to Dashboard</Button>
    </Box>
  );
}
export default NotFoundPage;
