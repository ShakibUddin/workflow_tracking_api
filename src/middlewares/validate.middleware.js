const ApiError = require('../utils/ApiError');

/**
 * Validates req[property] against a Joi schema (the request DTO) and
 * replaces it with the sanitized value on success.
 */
const validate = (schema, property = 'body') => (req, res, next) => {
  // abortEarly: false collects every failing field in one response instead of
  // just the first, so clients don't have to fix-and-resubmit repeatedly.
  // stripUnknown: true drops fields not defined in the schema (e.g. an id the
  // client mistakenly sent in the body) rather than rejecting the request for them.
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => detail.message);
    return next(ApiError.badRequest('Validation failed', details));
  }

  // `value` is Joi's sanitized output (trimmed strings, defaults applied,
  // unknown keys stripped) - downstream code must read the validated req[property],
  // not re-read the raw request, or it loses these guarantees.
  req[property] = value;
  return next();
};

module.exports = validate;
