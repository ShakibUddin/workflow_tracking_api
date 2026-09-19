const { Session } = require('../models');
const { Op } = require('sequelize');

class SessionRepository {
  async create(data, options) {
    return Session.create(data, options);
  }

  async findById(id, options) {
    return Session.findByPk(id, options);
  }

  // Oldest-used first, so callers evicting down to the session cap always
  // remove the least-recently-active session(s) first.
  async findActiveByUserId(userId, options) {
    return Session.findAll({
      where: { userId, status: 'ACTIVE' },
      order: [['lastUsedAt', 'ASC']],
      ...options,
    });
  }

  // Used by authenticate.middleware.js on every request - a session that's
  // been revoked or has slid past its expiry simply isn't returned, so an
  // access token minted for it stops working immediately rather than waiting
  // out its own (short) lifetime.
  async findActiveById(id) {
    return Session.findOne({
      where: { id, status: 'ACTIVE', expiresAt: { [Op.gt]: new Date() } },
    });
  }

  async revoke(session, reason, options) {
    return session.update({ status: 'REVOKED', revokedAt: new Date(), revokedReason: reason }, options);
  }

  async touch(session, expiresAt, options) {
    return session.update({ lastUsedAt: new Date(), expiresAt }, options);
  }
}

module.exports = new SessionRepository();
