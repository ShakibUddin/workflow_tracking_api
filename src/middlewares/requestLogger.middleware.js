const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  // Logged on 'finish' (after the response is sent), not here, so the log
  // line can include the actual status code and total request duration.
  res.on('finish', () => {
    logger.info('%s %s %d - %dms', req.method, req.originalUrl, res.statusCode, Date.now() - start);
  });
  next();
};

module.exports = requestLogger;
