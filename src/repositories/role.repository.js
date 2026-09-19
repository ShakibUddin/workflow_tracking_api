const { Role } = require('../models');

class RoleRepository {
  async findByName(name) {
    return Role.findOne({ where: { name } });
  }
}

module.exports = new RoleRepository();
