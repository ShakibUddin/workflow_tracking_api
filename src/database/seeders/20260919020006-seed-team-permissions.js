'use strict';

const { ROLES, PERMISSIONS } = require('../../constants/auth.constants');

const TEAM_PERMISSIONS = [
  PERMISSIONS.TEAM_CREATE,
  PERMISSIONS.TEAM_UPDATE,
  PERMISSIONS.TEAM_DELETE,
  PERMISSIONS.TEAM_MANAGE_MEMBERS,
  PERMISSIONS.TEAM_VIEW_ALL,
];

// All granted to ADMIN only - there's no employee-facing team-management
// action, matching the same "ADMIN gets everything, EMPLOYEE gets nothing
// extra" starting point used for the first permission batch (DECISIONS.md Q35).
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'permissions',
      TEAM_PERMISSIONS.map((name) => ({ name, created_at: now, updated_at: now }))
    );

    const [[adminRole]] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = '${ROLES.ADMIN}'`
    );
    const [newPermissions] = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE name IN (${TEAM_PERMISSIONS.map((name) => `'${name}'`).join(', ')})`
    );

    await queryInterface.bulkInsert(
      'role_permissions',
      newPermissions.map((permission) => ({
        role_id: adminRole.id,
        permission_id: permission.id,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', { name: TEAM_PERMISSIONS });
  },
};
