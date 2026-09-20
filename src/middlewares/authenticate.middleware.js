const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const sessionRepository = require('../repositories/session.repository');

// The frontend authenticates via the httpOnly accessToken cookie; the
// Authorization header is accepted too so the API can still be exercised
// directly (Postman, curl, service-to-service) without a cookie jar.
const authenticate = async (req, res, next) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.accessToken || bearerToken;

  if (!token) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  try {
    // A DB round trip on every authenticated request is the price of true
    // revocation: without it, revoking a session (logout, reuse detection,
    // session-limit eviction) would have no effect until the access token's
    // own short expiry caught up on its own.
    const session = await sessionRepository.findActiveById(payload.sid);
    if (!session) {
      return next(ApiError.unauthorized('Session has been revoked'));
    }

    req.user = {
      id: payload.sub,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      sessionId: payload.sid,
    };
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = authenticate;
