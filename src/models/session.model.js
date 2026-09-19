module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define(
    'Session',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      userAgent: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
      tableName: 'sessions',
      underscored: true,
      timestamps: true,
    }
  );

  Session.associate = (models) => {
    Session.belongsTo(models.User, { foreignKey: 'userId' });
    Session.hasOne(models.TokenFamily, { as: 'family', foreignKey: 'sessionId' });
  };

  return Session;
};
