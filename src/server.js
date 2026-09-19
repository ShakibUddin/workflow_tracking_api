const app = require('./app');
const { port } = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');

const start = async () => {
  try {
    // Verifies the DB is reachable before opening the HTTP port, so the
    // process fails fast on a bad connection instead of accepting requests
    // that would only fail later once a query actually runs.
    await sequelize.authenticate();
    logger.info('Database connection established');

    app.listen(port, () => {
      logger.info(`Workflow Tracking API listening on port ${port}`);
      logger.info(`Swagger docs available at http://localhost:${port}/api-docs`);
    });
  } catch (err) {
    logger.error('Unable to start server', { message: err.message, stack: err.stack });
    process.exit(1);
  }
};

start();

// Safety nets for errors that escape Express's request/response cycle
// entirely (e.g. a rejected promise with no .catch, or a throw outside any
// handler). Without these, Node would crash silently or with a raw stack dump.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});
