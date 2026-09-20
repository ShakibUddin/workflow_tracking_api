// Same technique as env.test.js: mock dotenv, reload in isolation per case.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const ORIGINAL_ENV = process.env;
const DB_KEYS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_DIALECT'];

const loadConfig = () => {
  let config;
  jest.isolateModules(() => {
    config = require('../../src/config/sequelize.config');
  });
  return config;
};

describe('src/config/sequelize.config.js', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    DB_KEYS.forEach((key) => delete process.env[key]);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('falls back to defaults, and derives the test database name from the base name', () => {
    const config = loadConfig();

    const expectedBase = {
      host: '127.0.0.1',
      port: 5432,
      username: 'postgres',
      password: '',
      database: 'workflow_tracking',
      dialect: 'postgres',
    };
    expect(config.development).toEqual(expectedBase);
    expect(config.production).toEqual(expectedBase);
    expect(config.test).toEqual({ ...expectedBase, database: 'workflow_tracking_test' });
  });

  it('uses explicit DB_* env vars for all three environments', () => {
    Object.assign(process.env, {
      DB_HOST: 'db.internal',
      DB_PORT: '6543',
      DB_NAME: 'custom_db',
      DB_USER: 'custom_user',
      DB_PASSWORD: 'secret',
      DB_DIALECT: 'mysql',
    });

    const config = loadConfig();

    expect(config.development).toEqual({
      host: 'db.internal',
      port: 6543,
      username: 'custom_user',
      password: 'secret',
      database: 'custom_db',
      dialect: 'mysql',
    });
    expect(config.test.database).toBe('custom_db_test');
  });
});
