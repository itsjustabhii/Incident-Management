/**
 * @file Create incident page
 * @description Form to create a new incident using React Hook Form + Zod.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, MenuItem, Select, InputLabel,
  FormControl, Button, Typography, Alert, CircularProgress, FormHelperText,
} from '@mui/material';
import { createIncidentSchema } from '../schemas/index.js';
import { useCreateIncidentMutation } from '../features/incidents/incidentApi.js';
import { INCIDENT_PRIORITY, INCIDENT_CATEGORY } from '../constants/index.js';

function CreateIncidentPage() {
  const navigate = useNavigate();
  const [createIncident, { isLoading, error }] = useCreateIncidentMutation();

  const { register, handleSubmit, formState: { errors }, control } = useForm({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: { priority: 'MEDIUM', category: 'OTHER' },
  });

  const onSubmit = async (data) => {
    try {
      const result = await createIncident(data).unwrap();
      navigate(`/incidents/${result.data.incident.id}`);
    } catch { /* Shown via error state */ }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} mb={3}>Create New Incident</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error?.data?.error?.message || 'Failed to create incident'}</Alert>}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              {...register('title')}
              label="Title"
              fullWidth
              margin="normal"
              error={!!errors.title}
              helperText={errors.title?.message}
              inputProps={{ 'aria-label': 'Incident title', maxLength: 255 }}
            />

            <TextField
              {...register('description')}
              label="Description"
              fullWidth
              multiline
              rows={5}
              margin="normal"
              error={!!errors.description}
              helperText={errors.description?.message}
              inputProps={{ 'aria-label': 'Incident description' }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <FormControl fullWidth error={!!errors.priority}>
                <InputLabel id="priority-label">Priority</InputLabel>
                <Select {...register('priority')} labelId="priority-label" label="Priority" defaultValue="MEDIUM">
                  {Object.values(INCIDENT_PRIORITY).map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
                {errors.priority && <FormHelperText>{errors.priority.message}</FormHelperText>}
              </FormControl>

              <FormControl fullWidth error={!!errors.category}>
                <InputLabel id="category-label">Category</InputLabel>
                <Select {...register('category')} labelId="category-label" label="Category" defaultValue="OTHER">
                  {Object.values(INCIDENT_CATEGORY).map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
                {errors.category && <FormHelperText>{errors.category.message}</FormHelperText>}
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => navigate('/incidents')} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Create Incident'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default CreateIncidentPage;
