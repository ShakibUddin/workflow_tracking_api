'use strict';

// Refresh tokens are no longer stored on the user row - they now live in
// their own sessions/token_families/refresh_tokens tables so a user can have
// multiple concurrent sessions, each with its own rotation history.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'refresh_token');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'refresh_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
};
