'use strict';

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('lookup', [
      { type: 'USER_STATUS', label: 'Active', value: 'ACTIVE', created_at: now, updated_at: now },
      { type: 'USER_STATUS', label: 'Inactive', value: 'INACTIVE', created_at: now, updated_at: now },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('lookup', { type: 'USER_STATUS' });
  },
};
