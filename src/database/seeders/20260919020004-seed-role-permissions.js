'use strict';

const { ROLES, PERMISSIONS } = require('../../constants/auth.constants');

// A fixed snapshot of the 3 permissions this seeder grants - NOT
// `Object.values(PERMISSIONS)` (see the note in 20260919020003-seed-permissions.js
// for why reading the live, growing enum here would double-grant permissions
// a later seeder, e.g. 20260919020006-seed-team-permissions.js, already owns).
// EMPLOYEE gets none for now - there's no employee-facing restricted action
// yet (see DECISIONS.md Q33). A later feature's own permissions get their
// own new seeder, not an edit to this one.
const grants = {
  [ROLES.ADMIN]: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE, PERMISSIONS.SESSION_MANAGE],
  [ROLES.EMPLOYEE]: [],
};

module.exports = {
  up: async (queryInterface) => {
    const [roles] = await queryInterface.sequelize.query('SELECT id, name FROM roles');
    const [permissions] = await queryInterface.sequelize.query('SELECT id, name FROM permissions');

    const roleIdByName = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    const permissionIdByName = Object.fromEntries(permissions.map((permission) => [permission.name, permission.id]));

    const now = new Date();
    const rows = Object.entries(grants).flatMap(([roleName, permissionNames]) =>
      permissionNames.map((permissionName) => ({
        role_id: roleIdByName[roleName],
        permission_id: permissionIdByName[permissionName],
        created_at: now,
        updated_at: now,
      }))
    );

    if (rows.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rows);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('role_permissions', null);
  },
};
