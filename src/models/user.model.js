module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      // Never sent to clients directly - src/dtos/auth.dto.js builds the
      // response by whitelisting fields, so the password hash is simply
      // never copied over, regardless of what a query loads.
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      // FK to lookup.id (type=USER_STATUS), not a plain enum column.
      status: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      underscored: true,
      timestamps: true,
    }
  );

  User.associate = (models) => {
    User.belongsToMany(models.Role, {
      through: models.UserRole,
      as: 'roles',
      foreignKey: 'userId',
      otherKey: 'roleId',
    });
    User.belongsTo(models.Lookup, { as: 'statusInfo', foreignKey: 'status' });
    User.belongsToMany(models.Team, {
      through: models.UserTeam,
      as: 'teams',
      foreignKey: 'userId',
      otherKey: 'teamId',
    });
    // Refresh-token/session state lives on Session/TokenFamily/RefreshToken,
    // not on User - see src/services/token.service.js.
    User.hasMany(models.Session, { as: 'sessions', foreignKey: 'userId' });
  };

  return User;
};
