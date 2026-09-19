const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1', routes);

// Order matters: notFoundHandler only runs if no route above matched, and
// errorHandler must be registered last so Express treats it as the error
// handler (it also catches whatever notFoundHandler forwards via next()).
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
