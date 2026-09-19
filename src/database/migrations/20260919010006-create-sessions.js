'use strict';

// One row per logged-in device/browser. authenticate.middleware.js checks
// this table on every request so revoking a session takes effect immediately,
// not just on the next refresh.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      user_agent: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      // Sliding expiry: extended on every successful refresh. A session that
      // hasn't been refreshed within this window is treated as expired
      // without needing a cleanup job to mark it so.
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_reason: {
        type: Sequelize.STRING(50),
        allowNull: true,
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

    // Enforcing the max-active-sessions-per-user cap and finding the oldest
    // session to evict both filter/sort on exactly these two columns.
    await queryInterface.addIndex('sessions', ['user_id', 'status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sessions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sessions_status";');
  },
};
