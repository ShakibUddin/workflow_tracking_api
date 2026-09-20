const { Op } = require('sequelize');
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

  // Backs the "search employees to add to a team" picker - name is matched
  // case-insensitively against first/last name, roleName narrows to users
  // who currently hold that role (e.g. only EMPLOYEE, never ADMIN).
  async search({ name, roleName } = {}, options) {
    const nameFilter = name
      ? {
          [Op.or]: [{ firstName: { [Op.iLike]: `%${name}%` } }, { lastName: { [Op.iLike]: `%${name}%` } }],
        }
      : {};

    return User.findAll({
      where: nameFilter,
      attributes: ['id', 'firstName', 'lastName', 'email'],
      include: [{ model: Role, as: 'roles', attributes: [], where: { name: roleName }, through: { attributes: [] } }],
      order: [['firstName', 'ASC']],
      ...options,
    });
  }
}

module.exports = new UserRepository();
