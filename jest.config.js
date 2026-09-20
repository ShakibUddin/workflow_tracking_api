module.exports = {
  testEnvironment: 'node',
  // Sets NODE_ENV=test before each test file's module registry loads, so
  // src/models/index.js picks the `test` block in sequelize.config.js
  // (the *_test database) instead of `development`.
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  // Runs once, in a separate process, before/after the whole suite - used to
  // create the test database and apply migrations/seeders exactly once
  // rather than once per test file.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 20000,
  // Coverage is measured over application code only:
  // - test helpers (tests/helpers/*) are test infrastructure, not app code
  // - src/server.js just boots the process (calls app.listen) - there's
  //   nothing to unit/integration-test there without actually binding a port
  // - src/database/** (migrations/seeders) are one-shot scripts run by
  //   sequelize-cli, never required by the app or exercised by a request
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/database/**'],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
