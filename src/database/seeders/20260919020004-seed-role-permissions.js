'use strict';

const { ROLES, PERMISSIONS } = require('../../constants/auth.constants');

// ADMIN gets every seeded permission; EMPLOYEE gets none for now - there's no
// employee-facing restricted action yet (see DECISIONS.md Q33). Extend the
// `grants` map below as real permissions are added.
const grants = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
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
