/**
 * @file Incident RTK Query endpoints + slice
 */

import { api } from '../../store/api.js';

export const incidentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** GET /incidents — paginated list with filters */
    getIncidents: builder.query({
      query: (params = {}) => {
        const qs = new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ).toString();
        return `/incidents${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result?.data?.incidents
          ? [
              ...result.data.incidents.map(({ id }) => ({ type: 'Incident', id })),
              { type: 'Incident', id: 'LIST' },
            ]
          : [{ type: 'Incident', id: 'LIST' }],
    }),

    /** GET /incidents/:id */
    getIncident: builder.query({
      query: (id) => `/incidents/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Incident', id }],
    }),

    /** POST /incidents */
    createIncident: builder.mutation({
      query: (body) => ({ url: '/incidents', method: 'POST', body }),
      invalidatesTags: [{ type: 'Incident', id: 'LIST' }, 'Dashboard'],
    }),

    /** PATCH /incidents/:id */
    updateIncident: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/incidents/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _err, { id }) => [
        { type: 'Incident', id },
        { type: 'Incident', id: 'LIST' },
        'Dashboard',
      ],
    }),

    /** DELETE /incidents/:id */
    deleteIncident: builder.mutation({
      query: (id) => ({ url: `/incidents/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Incident', id: 'LIST' }, 'Dashboard'],
    }),

    /** GET /incidents/:id/audit */
    getAuditLog: builder.query({
      query: ({ incidentId, ...params }) => {
        const qs = new URLSearchParams(params).toString();
        return `/incidents/${incidentId}/audit${qs ? `?${qs}` : ''}`;
      },
      providesTags: (_r, _e, { incidentId }) => [{ type: 'AuditLog', id: incidentId }],
    }),
  }),
});

export const {
  useGetIncidentsQuery,
  useGetIncidentQuery,
  useCreateIncidentMutation,
  useUpdateIncidentMutation,
  useDeleteIncidentMutation,
  useGetAuditLogQuery,
} = incidentApi;
