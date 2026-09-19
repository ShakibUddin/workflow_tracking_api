module.exports = (sequelize, DataTypes) => {
  const TokenFamily = sequelize.define(
    'TokenFamily',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'REVOKED', 'COMPROMISED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedReason: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: 'token_families',
      underscored: true,
      timestamps: true,
    }
  );

  TokenFamily.associate = (models) => {
    TokenFamily.belongsTo(models.Session, { as: 'session', foreignKey: 'sessionId' });
    TokenFamily.belongsTo(models.User, { foreignKey: 'userId' });
    TokenFamily.hasMany(models.RefreshToken, { as: 'tokens', foreignKey: 'familyId' });
  };

  return TokenFamily;
};
