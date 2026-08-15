/**
 * @file Register page
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, CircularProgress,
} from '@mui/material';
import { registerSchema } from '../schemas/index.js';
import { useRegisterMutation } from '../features/auth/authApi.js';
import { setCredentials } from '../features/auth/authSlice.js';

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [register, { isLoading, error }] = useRegisterMutation();

  const { register: formRegister, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      const result = await register(data).unwrap();
      dispatch(setCredentials({ user: result.data.user, accessToken: result.data.accessToken }));
      navigate('/dashboard', { replace: true });
    } catch { /* Shown via error state */ }
  };

  const apiError = error?.data?.error?.message;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 480 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700} mb={1} textAlign="center">Create Account</Typography>
          <Typography variant="body2" color="text.secondary" mb={3} textAlign="center">Join IncidentHub</Typography>

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField {...formRegister('displayName')} label="Full name" fullWidth margin="normal" error={!!errors.displayName} helperText={errors.displayName?.message} />
            <TextField {...formRegister('email')} label="Email address" type="email" fullWidth margin="normal" error={!!errors.email} helperText={errors.email?.message} />
            <TextField {...formRegister('password')} label="Password" type="password" fullWidth margin="normal" error={!!errors.password} helperText={errors.password?.message} />
            <TextField {...formRegister('confirmPassword')} label="Confirm password" type="password" fullWidth margin="normal" error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message} />

            <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 3, mb: 2 }} disabled={isLoading}>
              {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center">
            Already have an account? <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>Sign in</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RegisterPage;
