const { sequelize } = require('../models');
const sessionRepository = require('../repositories/session.repository');
const tokenFamilyRepository = require('../repositories/tokenFamily.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const userRepository = require('../repositories/user.repository');
const permissionService = require('./permission.service');
const { signAccessToken } = require('../utils/jwt');
const { generateRefreshToken, hashToken } = require('../utils/refreshToken');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { refreshToken: refreshTokenConfig } = require('../config/env');
const { TOKEN_FAMILY_STATUS, REFRESH_TOKEN_STATUS, REVOKE_REASON } = require('../constants/auth.constants');

const sessionExpiryFromNow = () => new Date(Date.now() + refreshTokenConfig.ttlDays * 24 * 60 * 60 * 1000);

/**
 * Owns the full lifecycle of sessions / token families / refresh tokens:
 * creation at login, rotation with reuse detection, and cascading
 * revocation. auth.service.js calls into this; it never touches these
 * tables directly.
 */
class TokenService {
  // Called from within signup/signin's own transaction so "evict oldest
  // session" and "create new session" are atomic with the credential check
  // that preceded them. Takes roles/permissions explicitly (rather than
  // reading user.roles) so callers don't need an association eager-loaded
  // just to mint a token - signup, for instance, knows the role it just
  // assigned without a reload.
  async issueSessionTokens(userId, roles, permissions, context, transaction) {
    // A Postgres advisory lock, scoped to this transaction, serializes every
    // concurrent login for THIS user through the count-then-insert section
    // below. Without it, two simultaneous logins can each run
    // "SELECT ... FOR UPDATE" and both see the same pre-existing session
    // count (row locks only protect rows that already exist - they don't
    // block a concurrent transaction from inserting a new one), so both skip
    // eviction and the cap ends up exceeded. This lock closes that phantom-read
    // gap; it costs nothing for logins from different users, which use different keys.
    await sequelize.query('SELECT pg_advisory_xact_lock(:userId::bigint)', {
      replacements: { userId: String(userId) },
      transaction,
    });

    await this.#enforceSessionLimit(userId, transaction);

    const session = await sessionRepository.create(
      {
        userId,
        userAgent: context.userAgent || null,
        ipAddress: context.ipAddress || null,
        lastUsedAt: new Date(),
        expiresAt: sessionExpiryFromNow(),
      },
      { transaction }
    );

    const family = await tokenFamilyRepository.create(
      { sessionId: session.id, userId },
      { transaction }
    );

    const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
    await refreshTokenRepository.create(
      { familyId: family.id, tokenHash, expiresAt },
      { transaction }
    );

    const accessToken = signAccessToken({
      sub: String(userId),
      roles,
      permissions,
      sid: String(session.id),
    });

    return { accessToken, refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  // The heart of the system: validate, detect reuse, rotate. Runs in its own
  // transaction with the refresh_tokens row locked for the duration, so a
  // token can never be rotated twice concurrently and reuse detection can
  // never race with a legitimate rotation.
  async rotate(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw ApiError.unauthorized('Refresh token missing');
    }

    const tokenHash = hashToken(rawRefreshToken);

    // IMPORTANT: when reuse is detected, the resulting revocation MUST
    // survive - but throwing from inside a managed sequelize.transaction()
    // callback rolls back everything the callback did, revocation included.
    // So the callback returns a { error } or { tokens } result instead of
    // ever throwing, and only once that transaction has committed do we
    // throw the error to the caller.
    const result = await sequelize.transaction(async (transaction) => {
      const currentToken = await refreshTokenRepository.findByHashForUpdate(tokenHash, transaction);

      if (!currentToken) {
        return { error: ApiError.unauthorized('Invalid refresh token') };
      }

      // Locking the family too (not just this token row) serializes every
      // operation against a given family - without it, a legitimate rotation
      // and a reuse-triggered revocation racing on two different tokens from
      // the same family could interleave and leave an ACTIVE token dangling
      // in an already-COMPROMISED family.
      const family = await tokenFamilyRepository.findById(currentToken.familyId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (family.status !== TOKEN_FAMILY_STATUS.ACTIVE) {
        return { error: ApiError.unauthorized('Session has been revoked') };
      }

      if (currentToken.status !== REFRESH_TOKEN_STATUS.ACTIVE) {
        // This exact token was already rotated away (or revoked) yet is
        // being presented again - the only way that happens is if someone
        // other than the legitimate client captured it. Kill the whole
        // lineage rather than just this token: the attacker may also be
        // holding whichever token superseded it.
        await this.#revokeFamilyCascade(family, REVOKE_REASON.REUSE_DETECTED, transaction);
        logger.error('Refresh token reuse detected - session revoked', {
          familyId: family.id,
          userId: family.userId,
          sessionId: family.sessionId,
        });
        return { error: ApiError.unauthorized('Refresh token reuse detected; session revoked') };
      }

      if (currentToken.expiresAt.getTime() < Date.now()) {
        await this.#revokeFamilyCascade(family, REVOKE_REASON.EXPIRED, transaction);
        return { error: ApiError.unauthorized('Refresh token expired') };
      }

      const session = await sessionRepository.findById(family.sessionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() < Date.now()) {
        return { error: ApiError.unauthorized('Session has been revoked') };
      }

      const { rawToken: newRawToken, tokenHash: newHash, expiresAt } = generateRefreshToken();
      const newToken = await refreshTokenRepository.create(
        { familyId: family.id, tokenHash: newHash, expiresAt },
        { transaction }
      );
      await refreshTokenRepository.markRotated(currentToken, newToken.id, { transaction });
      await sessionRepository.touch(session, sessionExpiryFromNow(), { transaction });

      const user = await userRepository.findById(family.userId, { transaction });
      if (!user) {
        return { error: ApiError.unauthorized('User no longer exists') };
      }
      const roles = (user.roles || []).map((role) => role.name);
      const permissions = await permissionService.resolveForRoles(roles, { transaction });
      const accessToken = signAccessToken({
        sub: String(user.id),
        roles,
        permissions,
        sid: String(session.id),
      });

      return { tokens: { accessToken, refreshToken: newRawToken, refreshTokenExpiresAt: expiresAt } };
    });

    if (result.error) {
      throw result.error;
    }
    return result.tokens;
  }

  // Not gated by a valid access token by design (see DECISIONS.md Q15):
  // logout must still work after the access token has expired. Resolves the
  // session via whichever token the cookie contains, active or not, and
  // revokes that session's entire family.
  async revokeByRawToken(rawRefreshToken) {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashToken(rawRefreshToken);

    await sequelize.transaction(async (transaction) => {
      const token = await refreshTokenRepository.findByHashForUpdate(tokenHash, transaction);
      if (!token) {
        return;
      }
      const family = await tokenFamilyRepository.findById(token.familyId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      await this.#revokeFamilyCascade(family, REVOKE_REASON.LOGOUT, transaction);
    });
  }

  // Enforces the N-active-session cap by evicting the oldest session(s) once
  // a new login would exceed it. Runs with the user's active sessions locked
  // for the duration of the transaction so two simultaneous logins can't
  // both count the same N-1 sessions and both skip eviction, landing the
  // user at N+1 active sessions.
  async #enforceSessionLimit(userId, transaction) {
    const activeSessions = await sessionRepository.findActiveByUserId(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const overflow = activeSessions.length - (refreshTokenConfig.maxActiveSessionsPerUser - 1);
    if (overflow <= 0) {
      return;
    }

    const toEvict = activeSessions.slice(0, overflow);
    for (const session of toEvict) {
      await this.#revokeSessionCascade(session, REVOKE_REASON.SESSION_LIMIT_EXCEEDED, transaction);
    }
  }

  async #revokeSessionCascade(session, reason, transaction) {
    await sessionRepository.revoke(session, reason, { transaction });
    const family = await tokenFamilyRepository.findBySessionId(session.id, { transaction });
    if (family) {
      await this.#revokeFamilyOnly(family, reason, transaction);
    }
  }

  async #revokeFamilyCascade(family, reason, transaction) {
    await this.#revokeFamilyOnly(family, reason, transaction);
    const session = await sessionRepository.findById(family.sessionId, { transaction });
    if (session && session.status === 'ACTIVE') {
      await sessionRepository.revoke(session, reason, { transaction });
    }
  }

  async #revokeFamilyOnly(family, reason, transaction) {
    const status = reason === REVOKE_REASON.REUSE_DETECTED ? TOKEN_FAMILY_STATUS.COMPROMISED : TOKEN_FAMILY_STATUS.REVOKED;
    await tokenFamilyRepository.revoke(family, status, reason, { transaction });
    await refreshTokenRepository.revokeActiveByFamilyId(family.id, reason, { transaction });
  }
}

module.exports = new TokenService();
