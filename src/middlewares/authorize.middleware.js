const ApiError = require('../utils/ApiError');

// Must run after authenticate.middleware.js (needs req.user.permissions).
// Checks membership against the permission action-strings embedded in the
// access token at sign-in - see DECISIONS.md Q33 for why that's a DB lookup
// (roles->role_permissions->permissions) done once at token-issue time
// rather than a query on every request.
const authorize = (...requiredPermissions) => (req, res, next) => {
  const granted = req.user?.permissions || [];
  const hasAll = requiredPermissions.every((permission) => granted.includes(permission));

  if (!hasAll) {
    return next(ApiError.forbidden('Insufficient permissions'));
  }

  return next();
};

module.exports = authorize;
