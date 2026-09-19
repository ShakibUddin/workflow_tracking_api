const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const { port } = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Workflow Tracking API',
      version: '1.0.0',
      description: 'API documentation for the Workflow Tracking service',
    },
    servers: [
      {
        url: `http://localhost:${port}/api/v1`,
        description: 'Local server',
      },
    ],
  },
  // swagger-jsdoc resolves these with `glob`, which only understands forward
  // slashes. path.join() emits backslashes on Windows, which silently matches
  // zero files instead of erroring - so paths are normalized before being passed in.
  apis: [
    path.join(__dirname, '..', 'routes', '*.js').split(path.sep).join('/'),
    path.join(__dirname, '..', 'dtos', '*.js').split(path.sep).join('/'),
  ],
};

module.exports = swaggerJsdoc(options);
