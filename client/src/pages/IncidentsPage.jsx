/**
 * @file Incidents list page
 * @description Paginated, filterable incident list with server-side sorting.
 * Real-time updates via WebSocket keep the list fresh without manual refreshes.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, MenuItem, Select, InputLabel, FormControl,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Typography, TablePagination, CircularProgress, Alert,
  InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useGetIncidentsQuery } from '../features/incidents/incidentApi.js';
import { useSocketContext } from '../components/providers/SocketProvider.jsx';
import { api } from '../store/api.js';
import { useDispatch } from 'react-redux';
import { INCIDENT_STATUS, INCIDENT_PRIORITY, STATUS_COLOUR, PRIORITY_COLOUR } from '../constants/index.js';
import { format } from 'date-fns';

/**
 * Incident list page.
 * Manages filter/sort state locally and passes them to the RTK Query hook.
 * WebSocket events trigger RTK Query cache invalidation for real-time updates.
 */
function IncidentsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { incidentSocket } = useSocketContext() || {};

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const queryParams = {
    page: page + 1,
    pageSize,
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.search && { search: filters.search }),
  };

  const { data, isLoading, error, refetch } = useGetIncidentsQuery(queryParams);
  const incidents = data?.data?.incidents || [];
  const total = data?.meta?.total || 0;

  // Listen for real-time incident changes and refresh the list accordingly
  useEffect(() => {
    if (!incidentSocket) return;
    const refresh = () => dispatch(api.util.invalidateTags([{ type: 'Incident', id: 'LIST' }]));
    incidentSocket.on('incident_created', refresh);
    incidentSocket.on('incident_updated', refresh);
    incidentSocket.on('incident_deleted', refresh);
    return () => {
      incidentSocket.off('incident_created', refresh);
      incidentSocket.off('incident_updated', refresh);
      incidentSocket.off('incident_deleted', refresh);
    };
  }, [incidentSocket, dispatch]);

  const handleFilterChange = (field) => (e) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
    setPage(0); // Reset to first page when filters change
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Incidents</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/incidents/new')}
          aria-label="Create new incident"
        >
          New Incident
        </Button>
      </Box>

      {/* Filters bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search incidents…"
          value={filters.search}
          onChange={handleFilterChange('search')}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 240 }}
          inputProps={{ 'aria-label': 'Search incidents' }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            value={filters.status}
            label="Status"
            onChange={handleFilterChange('status')}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(INCIDENT_STATUS).map((s) => (
              <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="priority-filter-label">Priority</InputLabel>
          <Select
            labelId="priority-filter-label"
            value={filters.priority}
            label="Priority"
            onChange={handleFilterChange('priority')}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(INCIDENT_PRIORITY).map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load incidents</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table aria-label="Incidents list" size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>SLA Breach</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No incidents found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((incident) => (
                  <TableRow
                    key={incident.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/incidents/${incident.id}`)}
                    aria-label={`View incident: ${incident.title}`}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 300 }}>
                        {incident.title}
                      </Typography>
                      {incident.slaBreached && (
                        <Chip label="SLA Breached" size="small" color="error" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={incident.status.replace('_', ' ')}
                        size="small"
                        color={STATUS_COLOUR[incident.status]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={incident.priority}
                        size="small"
                        color={PRIORITY_COLOUR[incident.priority]}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {incident.assignee?.displayName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={incident.slaBreached ? 'error.main' : 'text.secondary'}
                      >
                        {incident.slaBreachAt
                          ? format(new Date(incident.slaBreachAt), 'MMM d, HH:mm')
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(incident.createdAt), 'MMM d, yyyy')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Paper>
    </Box>
  );
}

export default IncidentsPage;
