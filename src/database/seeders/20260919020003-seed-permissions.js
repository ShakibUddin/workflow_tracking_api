'use strict';

const { PERMISSIONS } = require('../../constants/auth.constants');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'permissions',
      Object.values(PERMISSIONS).map((name) => ({ name, created_at: now, updated_at: now }))
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', { name: Object.values(PERMISSIONS) });
  },
};
