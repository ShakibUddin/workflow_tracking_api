// The dev-only console transport (and its custom printf formatter) never
// runs during the normal test suite, since NODE_ENV=test deliberately skips
// it (see logger.js). Reload the module with NODE_ENV=development to add it,
// then actually log through it so the formatter body executes.
const ORIGINAL_ENV = process.env;

const loadLogger = () => {
  let logger;
  jest.isolateModules(() => {
    logger = require('../../src/config/logger');
  });
  return logger;
};

describe('src/config/logger.js', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('adds a colorized console transport outside production/test, and its formatter handles both stack and plain messages', () => {
    process.env.NODE_ENV = 'development';
    const logger = loadLogger();

    const consoleTransport = logger.transports.find((t) => t.name === 'console');
    expect(consoleTransport).toBeDefined();

    // Exercises the `stack || message` branch (Error -> stack present, empty meta)
    // and the `Object.keys(meta).length` branch (plain message, meta present).
    expect(() => logger.error(new Error('boom'))).not.toThrow();
    expect(() => logger.info('plain message', { requestId: 'abc' })).not.toThrow();
  });

  it('does not add a console transport in production', () => {
    process.env.NODE_ENV = 'production';
    const logger = loadLogger();
    expect(logger.transports.find((t) => t.name === 'console')).toBeUndefined();
  });

  it('does not add a console transport in test (this suite\'s own env)', () => {
    process.env.NODE_ENV = 'test';
    const logger = loadLogger();
    expect(logger.transports.find((t) => t.name === 'console')).toBeUndefined();
  });
});
