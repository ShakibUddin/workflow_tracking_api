// Join table for the User <-> Role many-to-many relationship. Not used
// directly outside src/models - always accessed via User.roles / Role.users.
module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define(
    'UserRole',
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
      roleId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: 'user_roles',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'role_id'] }],
    }
  );

  return UserRole;
};
