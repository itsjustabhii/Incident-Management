/**
 * @file Async route handler wrapper
 * @description Wraps async Express route handlers to automatically forward
 * any unhandled promise rejections to the next() error handler.
 *
 * Without this wrapper, an unhandled rejection in an async controller would
 * silently hang the request or crash the process in older Node versions.
 *
 * @example
 * router.get('/incidents', catchAsync(async (req, res) => { ... }));
 *
 * @param {Function} fn - Async Express route handler or middleware
 * @returns {Function} Wrapped handler that catches rejections
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
