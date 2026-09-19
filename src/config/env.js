require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'workflow_tracking_api',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'postgres',
  },
  // Dev-only fallback secret so the app still boots without a .env file.
  // MUST be overridden via env vars in any real deployment.
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  },
  // Refresh tokens are opaque random strings validated by DB lookup, not
  // JWTs, so they have no secret/algorithm of their own - just a lifetime.
  refreshToken: {
    ttlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) || 7,
    maxActiveSessionsPerUser: parseInt(process.env.MAX_ACTIVE_SESSIONS_PER_USER, 10) || 3,
  },
};
