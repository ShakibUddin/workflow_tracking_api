const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Express recognizes this as an error handler purely by its 4-argument
// signature (err, req, res, next) - dropping any of these breaks routing.
const errorHandler = (err, req, res, next) => {
  // Anything not thrown as an ApiError (e.g. a Sequelize/driver failure) is
  // treated as unexpected and masked with a generic message, so internals
  // (SQL, stack traces, file paths) never leak into the API response.
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(err.message, { path: req.originalUrl, details: err.details });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
};

module.exports = { notFoundHandler, errorHandler };
