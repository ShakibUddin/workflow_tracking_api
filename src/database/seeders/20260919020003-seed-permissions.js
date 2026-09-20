'use strict';

const { PERMISSIONS } = require('../../constants/auth.constants');

// A fixed snapshot of the 3 permissions that existed when this seeder was
// written - NOT `Object.values(PERMISSIONS)`, which reads whatever is in the
// shared enum *at seed-run time*. Since PERMISSIONS keeps growing as new
// features add their own action-strings (e.g. team:* in a later seeder),
// reading the live object here would make this old seeder re-insert every
// permission added after it, duplicate-key-colliding with whichever later
// seeder actually owns them. Each seeder must stay a closed, point-in-time
// list - see the equivalent note in 20260919020004-seed-role-permissions.js.
const PERMISSION_NAMES = [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE, PERMISSIONS.SESSION_MANAGE];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'permissions',
      PERMISSION_NAMES.map((name) => ({ name, created_at: now, updated_at: now }))
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', { name: PERMISSION_NAMES });
  },
};
