/**
 * @file Dashboard RTK Query endpoints
 */

import { api } from '../../store/api.js';

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query({
      query: () => '/dashboard/stats',
      providesTags: ['Dashboard'],
    }),
    getSlaMetrics: builder.query({
      query: () => '/dashboard/sla',
      providesTags: ['Dashboard'],
    }),
    getWorkload: builder.query({
      query: () => '/dashboard/workload',
      providesTags: ['Dashboard'],
    }),
    getTrends: builder.query({
      query: () => '/dashboard/trends',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetSlaMetricsQuery,
  useGetWorkloadQuery,
  useGetTrendsQuery,
} = dashboardApi;
