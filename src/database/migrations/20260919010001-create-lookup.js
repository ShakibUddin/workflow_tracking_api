'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lookup', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Lookups are always resolved by (type, value) - e.g. USER_STATUS/ACTIVE - not by id.
    await queryInterface.addIndex('lookup', ['type', 'value']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('lookup');
  },
};
