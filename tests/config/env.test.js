// Pure unit test of the config-bootstrap module: no DB, no app. Mocks
// `dotenv` so a real .env file on disk can never leak values into the
// "defaults" case below, then reloads src/config/env.js in isolation for
// each combination of env vars to exercise every `process.env.X || default` branch.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const ORIGINAL_ENV = process.env;

const ENV_KEYS = [
  'NODE_ENV', 'PORT', 'LOG_LEVEL', 'CORS_ORIGIN',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_DIALECT',
  'JWT_ACCESS_SECRET', 'JWT_ACCESS_EXPIRES_IN', 'BCRYPT_SALT_ROUNDS',
  'REFRESH_TOKEN_TTL_DAYS', 'MAX_ACTIVE_SESSIONS_PER_USER',
];

const loadEnv = () => {
  let env;
  jest.isolateModules(() => {
    env = require('../../src/config/env');
  });
  return env;
};

describe('src/config/env.js', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('falls back to hardcoded defaults when no env vars are set', () => {
    const env = loadEnv();

    expect(env.env).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.logLevel).toBe('info');
    expect(env.corsOrigin).toBe('http://localhost:5173');
    expect(env.db).toEqual({
      host: '127.0.0.1',
      port: 5432,
      name: 'workflow_tracking_api',
      user: 'postgres',
      password: '',
      dialect: 'postgres',
    });
    expect(env.jwt).toEqual({ accessSecret: 'dev-access-secret-change-me', accessExpiresIn: '15m' });
    expect(env.bcrypt).toEqual({ saltRounds: 10 });
    expect(env.refreshToken).toEqual({ ttlDays: 7, maxActiveSessionsPerUser: 3 });
  });

  it('prefers explicit env vars over defaults', () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      PORT: '4321',
      LOG_LEVEL: 'debug',
      CORS_ORIGIN: 'https://app.example.com',
      DB_HOST: 'db.internal',
      DB_PORT: '6543',
      DB_NAME: 'custom_db',
      DB_USER: 'custom_user',
      DB_PASSWORD: 'secret',
      DB_DIALECT: 'mysql',
      JWT_ACCESS_SECRET: 'real-secret',
      JWT_ACCESS_EXPIRES_IN: '5m',
      BCRYPT_SALT_ROUNDS: '12',
      REFRESH_TOKEN_TTL_DAYS: '14',
      MAX_ACTIVE_SESSIONS_PER_USER: '5',
    });

    const env = loadEnv();

    expect(env.env).toBe('production');
    expect(env.port).toBe(4321);
    expect(env.logLevel).toBe('debug');
    expect(env.corsOrigin).toBe('https://app.example.com');
    expect(env.db).toEqual({
      host: 'db.internal',
      port: 6543,
      name: 'custom_db',
      user: 'custom_user',
      password: 'secret',
      dialect: 'mysql',
    });
    expect(env.jwt).toEqual({ accessSecret: 'real-secret', accessExpiresIn: '5m' });
    expect(env.bcrypt).toEqual({ saltRounds: 12 });
    expect(env.refreshToken).toEqual({ ttlDays: 14, maxActiveSessionsPerUser: 5 });
  });
});
