const { Role, Permission } = require('../models');

class RoleRepository {
  async findByName(name) {
    return Role.findOne({ where: { name } });
  }

  // Dedupes across roles: a permission granted to two of a user's roles is
  // only reported once.
  async findPermissionNamesByRoleNames(roleNames, options) {
    if (!roleNames || roleNames.length === 0) {
      return [];
    }

    const roles = await Role.findAll({
      where: { name: roleNames },
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
      ...options,
    });

    const names = new Set();
    roles.forEach((role) => (role.permissions || []).forEach((permission) => names.add(permission.name)));
    return Array.from(names);
  }
}

module.exports = new RoleRepository();
