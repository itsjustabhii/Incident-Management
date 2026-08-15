/**
 * @file Comment RTK Query endpoints
 */

import { api } from '../../store/api.js';

export const commentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getComments: builder.query({
      query: ({ incidentId, ...params }) => {
        const qs = new URLSearchParams(params).toString();
        return `/incidents/${incidentId}/comments${qs ? `?${qs}` : ''}`;
      },
      providesTags: (_r, _e, { incidentId }) => [{ type: 'Comment', id: incidentId }],
    }),

    createComment: builder.mutation({
      query: ({ incidentId, ...body }) => ({
        url: `/incidents/${incidentId}/comments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { incidentId }) => [{ type: 'Comment', id: incidentId }],
    }),

    updateComment: builder.mutation({
      query: ({ incidentId, commentId, ...body }) => ({
        url: `/incidents/${incidentId}/comments/${commentId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { incidentId }) => [{ type: 'Comment', id: incidentId }],
    }),

    deleteComment: builder.mutation({
      query: ({ incidentId, commentId }) => ({
        url: `/incidents/${incidentId}/comments/${commentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { incidentId }) => [{ type: 'Comment', id: incidentId }],
    }),
  }),
});

export const {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
} = commentApi;
