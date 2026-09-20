// A generic work unit (software team, video editing team, marketing team,
// etc.) - deliberately has no notion of "type" beyond its title/description.
module.exports = (sequelize, DataTypes) => {
  const Team = sequelize.define(
    'Team',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // FK to lookup.id (type=TEAM_STATUS), not a plain enum column - same
      // pattern as User.status (see DECISIONS.md Q17).
      teamStatusId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      tableName: 'teams',
      underscored: true,
      timestamps: true,
    }
  );

  Team.associate = (models) => {
    Team.belongsToMany(models.User, {
      through: models.UserTeam,
      as: 'members',
      foreignKey: 'teamId',
      otherKey: 'userId',
    });
    Team.belongsTo(models.Lookup, { as: 'statusInfo', foreignKey: 'teamStatusId' });
  };

  return Team;
};
