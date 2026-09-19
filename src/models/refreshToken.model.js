module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      familyId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      // SHA-256 hex digest of the raw token - the raw value itself is never
      // persisted anywhere (see src/utils/refreshToken.js).
      tokenHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'ROTATED', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      rotatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedReason: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      replacedById: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      tableName: 'refresh_tokens',
      underscored: true,
      timestamps: true,
    }
  );

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.TokenFamily, { as: 'family', foreignKey: 'familyId' });
    RefreshToken.belongsTo(models.RefreshToken, { as: 'replacedBy', foreignKey: 'replacedById' });
  };

  return RefreshToken;
};
