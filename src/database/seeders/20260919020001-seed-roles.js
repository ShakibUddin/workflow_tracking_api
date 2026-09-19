'use strict';

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('roles', [
      { name: 'ADMIN', created_at: now, updated_at: now },
      { name: 'EMPLOYEE', created_at: now, updated_at: now },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('roles', { name: ['ADMIN', 'EMPLOYEE'] });
  },
};
