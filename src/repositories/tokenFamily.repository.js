const { TokenFamily } = require('../models');

class TokenFamilyRepository {
  async create(data, options) {
    return TokenFamily.create(data, options);
  }

  async findBySessionId(sessionId, options) {
    return TokenFamily.findOne({ where: { sessionId }, ...options });
  }

  async findById(id, options) {
    return TokenFamily.findByPk(id, options);
  }

  async revoke(family, status, reason, options) {
    return family.update({ status, revokedAt: new Date(), revokedReason: reason }, options);
  }
}

module.exports = new TokenFamilyRepository();
