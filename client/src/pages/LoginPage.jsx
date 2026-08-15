/**
 * @file Login page
 * @description Full-page login form using React Hook Form + Zod validation.
 * On success, stores credentials in Redux and navigates to the originally
 * requested route (or dashboard if no prior route was saved).
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { loginSchema } from '../schemas/index.js';
import { useLoginMutation } from '../features/auth/authApi.js';
import { setCredentials } from '../features/auth/authSlice.js';
import { useGetMeQuery } from '../features/auth/authApi.js';

/**
 * Login page component.
 * Handles form state, validation, submission, and post-login navigation.
 */
function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigate back to the originally requested page after login
  const from = location.state?.from?.pathname || '/dashboard';

  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  /**
   * Submits the login form. On success, dispatches credentials to Redux and
   * navigates to the target page.
   */
  const onSubmit = async (data) => {
    try {
      const result = await login(data).unwrap();
      dispatch(setCredentials({
        user: result.data.user,
        accessToken: result.data.accessToken,
      }));
      navigate(from, { replace: true });
    } catch {
      // Error is shown via the RTK Query error state
    }
  };

  const apiError = error?.data?.error?.message;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700} mb={1} textAlign="center">
            IncidentHub
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3} textAlign="center">
            Sign in to your account
          </Typography>

          {/* Show API error if login fails */}
          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {apiError}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Login form"
          >
            <TextField
              {...register('email')}
              label="Email address"
              type="email"
              fullWidth
              margin="normal"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              helperText={errors.email?.message}
              inputProps={{ 'aria-label': 'Email address' }}
            />
            <TextField
              {...register('password')}
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              inputProps={{ 'aria-label': 'Password' }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center">
            Don&apos;t have an account?{' '}
            <Link to="/register" style={{ color: 'inherit', fontWeight: 600 }}>
              Register
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;
