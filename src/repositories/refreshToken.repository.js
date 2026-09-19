const { RefreshToken } = require('../models');

class RefreshTokenRepository {
  async create(data, options) {
    return RefreshToken.create(data, options);
  }

  // Locked (FOR UPDATE) inside a transaction during rotation so two
  // concurrent requests presenting the same refresh token can't both see it
  // as ACTIVE and both successfully rotate it - see token.service.js#rotate.
  // No `include` here: Postgres rejects FOR UPDATE combined with an outer
  // join, which is what Sequelize generates for a plain belongsTo include -
  // the family is fetched separately instead.
  async findByHashForUpdate(tokenHash, transaction) {
    return RefreshToken.findOne({
      where: { tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  async markRotated(token, replacedById, options) {
    return token.update({ status: 'ROTATED', rotatedAt: new Date(), replacedById }, options);
  }

  async revoke(token, reason, options) {
    return token.update({ status: 'REVOKED', revokedAt: new Date(), revokedReason: reason }, options);
  }

  // Used when a family is killed (logout, reuse detection, eviction) so any
  // token that's still ACTIVE for it stops being usable, in one statement.
  async revokeActiveByFamilyId(familyId, reason, options) {
    return RefreshToken.update(
      { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason },
      { where: { familyId, status: 'ACTIVE' }, ...options }
    );
  }
}

module.exports = new RefreshTokenRepository();
