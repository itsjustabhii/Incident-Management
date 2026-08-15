/**
 * @file Incident detail page
 * @description Shows the full incident record with status/priority controls,
 * comment thread, file attachments, and audit history.
 * Real-time updates are handled via Socket.IO room subscription.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box, Grid, Card, CardContent, Typography, Chip, CircularProgress,
  Alert, Divider, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useGetIncidentQuery } from '../features/incidents/incidentApi.js';
import { useSocketContext } from '../components/providers/SocketProvider.jsx';
import { api } from '../store/api.js';
import { STATUS_COLOUR, PRIORITY_COLOUR } from '../constants/index.js';
import { format } from 'date-fns';

/**
 * Incident detail page.
 * Subscribes to the incident's Socket.IO room to receive real-time updates.
 * Invalidates the RTK Query cache for this incident when an update event arrives.
 */
function IncidentDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { incidentSocket } = useSocketContext() || {};

  const { data, isLoading, error } = useGetIncidentQuery(id);
  const incident = data?.data?.incident;

  // Join the incident-specific Socket.IO room for real-time updates
  useEffect(() => {
    if (!incidentSocket || !id) return;
    incidentSocket.emit('join_incident', { incidentId: id });

    const handleUpdate = () => {
      dispatch(api.util.invalidateTags([{ type: 'Incident', id }]));
    };
    incidentSocket.on('incident_updated', handleUpdate);
    incidentSocket.on('comment_added', handleUpdate);

    return () => {
      incidentSocket.emit('leave_incident', { incidentId: id });
      incidentSocket.off('incident_updated', handleUpdate);
      incidentSocket.off('comment_added', handleUpdate);
    };
  }, [incidentSocket, id, dispatch]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load incident. {error?.data?.error?.message}</Alert>;
  if (!incident) return null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/incidents')} sx={{ mb: 2 }}>
        Back to Incidents
      </Button>

      <Grid container spacing={3}>
        {/* Main incident details */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={incident.status.replace('_', ' ')}
                  color={STATUS_COLOUR[incident.status]}
                  variant="outlined"
                />
                <Chip
                  label={incident.priority}
                  color={PRIORITY_COLOUR[incident.priority]}
                />
                {incident.slaBreached && <Chip label="SLA BREACHED" color="error" />}
              </Box>

              <Typography variant="h4" fontWeight={700} gutterBottom>
                {incident.title}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {incident.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar metadata */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reported By</Typography>
                  <Typography variant="body2">{incident.reportedBy?.displayName || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Assigned To</Typography>
                  <Typography variant="body2">{incident.assignee?.displayName || 'Unassigned'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Team</Typography>
                  <Typography variant="body2">{incident.team?.name || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Category</Typography>
                  <Typography variant="body2">{incident.category}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">SLA Deadline</Typography>
                  <Typography
                    variant="body2"
                    color={incident.slaBreached ? 'error.main' : 'text.primary'}
                  >
                    {incident.slaBreachAt
                      ? format(new Date(incident.slaBreachAt), 'MMM d, yyyy HH:mm')
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                  <Typography variant="body2">
                    {format(new Date(incident.createdAt), 'MMM d, yyyy HH:mm')}
                  </Typography>
                </Box>
                {incident.resolvedAt && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Resolved</Typography>
                    <Typography variant="body2">
                      {format(new Date(incident.resolvedAt), 'MMM d, yyyy HH:mm')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default IncidentDetailPage;
