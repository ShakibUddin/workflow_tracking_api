'use strict';

// Only the SHA-256 hash of each refresh token is ever stored - identical to
// how passwords are handled. A DB leak alone can never be turned back into a
// usable refresh token. Rotation history lives here as a linked list via
// replaced_by_id: each token points forward to whichever token superseded it.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('refresh_tokens', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      family_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'token_families', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'ROTATED', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      rotated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_reason: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      replaced_by_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'refresh_tokens', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    // token_hash already got a unique index from `unique: true` above - it's
    // the single most performance- and security-critical lookup in the system
    // (every rotation/reuse-check starts there).
    // Bulk-revoking every still-active token in a compromised family filters on this pair.
    await queryInterface.addIndex('refresh_tokens', ['family_id', 'status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_refresh_tokens_status";');
  },
};
