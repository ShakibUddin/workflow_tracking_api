const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Maps common Sequelize error classes to an ApiError so a race condition
// (e.g. two concurrent signups for the same email both passing the
// service-level pre-check) still surfaces as a clean 409/400 instead of a
// raw 500 with a Postgres error message.
const normalizeError = (err) => {
  if (err instanceof ApiError) {
    return err;
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return ApiError.conflict(err.errors?.[0]?.message || 'Resource already exists');
  }
  if (err.name === 'SequelizeValidationError') {
    return ApiError.badRequest('Validation failed', err.errors?.map((detail) => detail.message));
  }
  return null;
};

// Express recognizes this as an error handler purely by its 4-argument
// signature (err, req, res, next) - dropping any of these breaks routing.
const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);
  // Anything that isn't a recognized ApiError/Sequelize error (e.g. a raw
  // driver failure) is treated as unexpected and masked with a generic
  // message, so internals (SQL, stack traces, file paths) never leak into the API response.
  const statusCode = apiError ? apiError.statusCode : 500;
  const message = apiError ? apiError.message : 'Internal server error';
  const details = apiError ? apiError.details : null;

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(message, { path: req.originalUrl, details });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
};

module.exports = { notFoundHandler, errorHandler };
