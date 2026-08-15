/**
 * @file Dashboard page
 * @description Management dashboard with KPI cards, SLA metrics, workload
 * distribution, and incident volume trends. Data comes from RTK Query endpoints
 * with Redis caching on the backend.
 */

import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Alert,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import {
  useGetDashboardStatsQuery,
  useGetSlaMetricsQuery,
  useGetWorkloadQuery,
  useGetTrendsQuery,
} from '../features/dashboard/dashboardApi.js';

/**
 * Renders a KPI stat card with a label, value, and optional colour.
 */
function StatCard({ label, value, colour = 'text.primary' }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
        <Typography variant="h3" fontWeight={700} color={colour}>{value ?? '—'}</Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard page component.
 * Displays platform-wide incident analytics for managers and admins.
 * Engineers see a filtered view scoped to their own incidents.
 */
function DashboardPage() {
  const { data: statsData, isLoading: statsLoading, error: statsError } = useGetDashboardStatsQuery();
  const { data: slaData, isLoading: slaLoading } = useGetSlaMetricsQuery();
  const { data: workloadData, isLoading: workloadLoading } = useGetWorkloadQuery();
  const { data: trendsData, isLoading: trendsLoading } = useGetTrendsQuery();

  const stats = statsData?.data;
  const sla = slaData?.data;
  const workload = workloadData?.data || [];
  const trends = trendsData?.data || [];

  if (statsLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (statsError) return <Alert severity="error">Failed to load dashboard data</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>Dashboard</Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Open Incidents" value={stats?.totalOpen} colour="warning.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="SLA Breached" value={stats?.slaBreached} colour="error.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="SLA Compliance" value={sla ? `${sla.complianceRate}%` : '—'} colour="success.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Total Compliant" value={sla?.compliant} colour="primary.main" />
        </Grid>
      </Grid>

      {/* Charts row */}
      <Grid container spacing={3}>
        {/* Incident volume trend */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Incident Trend (30 days)</Typography>
              {trendsLoading ? (
                <CircularProgress size={24} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trends} aria-label="Incident volume over 30 days">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#1565C0" strokeWidth={2} dot={false} name="Incidents" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Engineer workload */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Engineer Workload</Typography>
              {workloadLoading ? (
                <CircularProgress size={24} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={workload} layout="vertical" aria-label="Open incidents per engineer">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="displayName" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="openIncidents" fill="#1565C0" name="Open Incidents" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Incidents by status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Incidents by Status</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(stats?.byStatus || []).map((s) => (
                  <Chip key={s.status} label={`${s.status}: ${s._count.status}`} variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Open incidents by priority */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Open Incidents by Priority</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(stats?.byPriority || []).map((p) => (
                  <Chip key={p.priority} label={`${p.priority}: ${p._count.priority}`} variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardPage;
