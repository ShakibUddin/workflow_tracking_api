// Join table for the Role <-> Permission many-to-many relationship. Not used
// directly outside src/models - always accessed via Role.permissions / Permission.roles.
module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    'RolePermission',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      roleId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      permissionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: 'role_permissions',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['role_id', 'permission_id'] }],
    }
  );

  return RolePermission;
};
