const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { corsOrigin } = require('./config/env');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler.middleware');

const app = express();

// Sets a battle-tested set of security-related HTTP response headers (CSP,
// HSTS, X-Frame-Options, etc.) in one call - see DECISIONS.md Q40.
app.use(helmet());
// credentials: true + an explicit origin (not '*') are both required for the
// browser to accept/send the httpOnly auth cookies on cross-origin requests.
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1', routes);

// Order matters: notFoundHandler only runs if no route above matched, and
// errorHandler must be registered last so Express treats it as the error
// handler (it also catches whatever notFoundHandler forwards via next()).
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
