module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'roles',
      underscored: true,
      timestamps: true,
    }
  );

  Role.associate = (models) => {
    Role.belongsToMany(models.User, {
      through: models.UserRole,
      as: 'users',
      foreignKey: 'roleId',
      otherKey: 'userId',
    });
  };

  return Role;
};
