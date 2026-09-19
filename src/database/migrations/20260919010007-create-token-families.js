'use strict';

// A token family is the rotation lineage for one session's refresh tokens.
// Splitting this out from `sessions` (rather than tracking rotation state
// directly on the session) keeps "is this session logged in" separate from
// "is this specific chain of refresh tokens still trustworthy" - the two
// diverge the moment reuse is detected: the session and family are both
// killed, but the distinction matters for auditing why.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('token_families', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      session_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true, // one family per session for its entire lifetime
        references: { model: 'sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Denormalized from sessions.user_id to support "revoke every family
      // belonging to this user" queries without a join.
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'REVOKED', 'COMPROMISED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
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

    await queryInterface.addIndex('token_families', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('token_families');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_token_families_status";');
  },
};
