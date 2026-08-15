/**
 * @file Pagination utilities
 * @description Helper functions for server-side pagination.
 * All list endpoints paginate server-side to prevent unbounded result sets
 * from degrading API performance and client rendering.
 */

/**
 * Parses pagination query parameters from a request query string,
 * applying sensible defaults and capping the page size to prevent
 * clients from requesting arbitrarily large datasets.
 *
 * @param {object} query - Express req.query object
 * @param {string|number} [query.page=1] - 1-based page number
 * @param {string|number} [query.pageSize=20] - Results per page
 * @returns {{ skip: number, take: number, page: number, pageSize: number }}
 */
export function parsePagination(query) {
  const MAX_PAGE_SIZE = 100;
  const DEFAULT_PAGE_SIZE = 20;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE),
  );

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
}

/**
 * Constructs the standard pagination metadata object included in list
 * API responses so clients can implement page controls without making
 * an additional count request.
 *
 * @param {number} total - Total number of records matching the query
 * @param {number} page - Current page number (1-based)
 * @param {number} pageSize - Number of results per page
 * @returns {{ page: number, pageSize: number, total: number, totalPages: number }}
 */
export function buildPaginationMeta(total, page, pageSize) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
