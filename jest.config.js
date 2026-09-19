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
};
