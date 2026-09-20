const roleRepository = require('../repositories/role.repository');

// Thin wrapper around roleRepository so auth.service.js and token.service.js
// share one place that turns a user's role names into their permission
// action-strings, instead of each duplicating the role->permission join.
class PermissionService {
  async resolveForRoles(roleNames, options) {
    return roleRepository.findPermissionNamesByRoleNames(roleNames, options);
  }
}

module.exports = new PermissionService();
