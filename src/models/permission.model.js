module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    'Permission',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      // An action string (e.g. "workflow:create"), never a URL/route - see
      // DECISIONS.md Q33. Enforcement checks this value directly.
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'permissions',
      underscored: true,
      timestamps: true,
    }
  );

  Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      as: 'roles',
      foreignKey: 'permissionId',
      otherKey: 'roleId',
    });
  };

  return Permission;
};
