const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
});

const LOOKUP_TYPES = Object.freeze({
  USER_STATUS: 'USER_STATUS',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
});

const TOKEN_FAMILY_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  // Revoked through a normal, expected path (logout, session-limit eviction, expiry).
  REVOKED: 'REVOKED',
  // Revoked because a rotated-away or already-revoked refresh token was
  // presented again - treated as theft, distinct from a normal revocation.
  COMPROMISED: 'COMPROMISED',
});

const REFRESH_TOKEN_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ROTATED: 'ROTATED',
  REVOKED: 'REVOKED',
});

// Free-text-ish (not a DB enum) diagnostic reason stamped on a revoked
// session/family/token, so incident review doesn't have to guess why
// something died. New reasons can be added without a migration.
const REVOKE_REASON = Object.freeze({
  LOGOUT: 'logout',
  REUSE_DETECTED: 'reuse_detected',
  SESSION_LIMIT_EXCEEDED: 'session_limit_exceeded',
  EXPIRED: 'expired',
});

module.exports = {
  ROLES,
  LOOKUP_TYPES,
  USER_STATUS,
  SESSION_STATUS,
  TOKEN_FAMILY_STATUS,
  REFRESH_TOKEN_STATUS,
  REVOKE_REASON,
};
