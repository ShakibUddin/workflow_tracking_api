const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
});

// Action strings, not routes/URLs (see DECISIONS.md Q33) - a starter set
// scoped to what already exists (user administration). Extend this as real
// domain resources (e.g. workflows) get built; nothing here is enforced on
// any route yet since none currently need it.
const PERMISSIONS = Object.freeze({
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  SESSION_MANAGE: 'session:manage',
  TEAM_CREATE: 'team:create',
  TEAM_UPDATE: 'team:update',
  TEAM_DELETE: 'team:delete',
  TEAM_MANAGE_MEMBERS: 'team:manage_members',
  TEAM_VIEW_ALL: 'team:view_all',
});

const LOOKUP_TYPES = Object.freeze({
  USER_STATUS: 'USER_STATUS',
  TEAM_STATUS: 'TEAM_STATUS',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

const TEAM_STATUS = Object.freeze({
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
  PERMISSIONS,
  LOOKUP_TYPES,
  USER_STATUS,
  TEAM_STATUS,
  SESSION_STATUS,
  TOKEN_FAMILY_STATUS,
  REFRESH_TOKEN_STATUS,
  REVOKE_REASON,
};
