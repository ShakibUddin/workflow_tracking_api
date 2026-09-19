const crypto = require('crypto');
const { refreshToken: refreshTokenConfig } = require('../config/env');

// 64 random bytes -> 128 hex chars -> 512 bits of entropy, far beyond what's
// brute-forceable. Opaque on purpose: unlike a JWT it carries no claims, so
// leaking one line of a log or a URL reveals nothing about the session it
// belongs to.
const TOKEN_BYTES = 64;

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

// Generates a new refresh token pair: the raw value (given to the client,
// never stored) and its hash + expiry (what actually gets persisted).
const generateRefreshToken = () => {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + refreshTokenConfig.ttlDays * 24 * 60 * 60 * 1000);
  return { rawToken, tokenHash: hashToken(rawToken), expiresAt };
};

module.exports = { generateRefreshToken, hashToken };
