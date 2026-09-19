const { User, Role, Lookup } = require('../models');

// Roles and status are cheap to join and needed by nearly every auth
// operation (token claims, response shaping, status checks), so they're
// always eager-loaded here instead of exposing per-call include flags.
const defaultIncludes = [
  { model: Role, as: 'roles', through: { attributes: [] } },
  { model: Lookup, as: 'statusInfo' },
];

class UserRepository {
  async findByEmail(email, options) {
    return User.findOne({ where: { email }, include: defaultIncludes, ...options });
  }

  async findById(id, options) {
    return User.findByPk(id, { include: defaultIncludes, ...options });
  }

  async create(data, options) {
    return User.create(data, options);
  }
}

module.exports = new UserRepository();
