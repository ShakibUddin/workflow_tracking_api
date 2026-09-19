const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');

// Only the access token is a JWT. The refresh token is an opaque random
// string validated by DB lookup (src/utils/refreshToken.js) - see Q20 in
// DECISIONS.md for why that split exists.
const signAccessToken = (payload) =>
  jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, jwtConfig.accessSecret);

// Reads the token's own `exp` claim so the access token cookie's maxAge
// always matches the token's real lifetime, instead of a second,
// independently-configured value that could drift out of sync with JWT_ACCESS_EXPIRES_IN.
const getTokenExpiryMs = (token) => jwt.decode(token).exp * 1000;

module.exports = {
  signAccessToken,
  verifyAccessToken,
  getTokenExpiryMs,
};
