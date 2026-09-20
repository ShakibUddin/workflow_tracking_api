// Join table for the User <-> Team many-to-many relationship. Not used
// directly outside src/models - always accessed via User.teams / Team.members.
module.exports = (sequelize, DataTypes) => {
  const UserTeam = sequelize.define(
    'UserTeam',
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
      teamId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: 'user_teams',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'team_id'] }],
    }
  );

  return UserTeam;
};
