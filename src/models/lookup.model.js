// Generic key/value lookup table for enum-like data (e.g. USER_STATUS values)
// that's cheap to extend without a migration for every new "type" of enum.
module.exports = (sequelize, DataTypes) => {
  const Lookup = sequelize.define(
    'Lookup',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      value: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'lookup',
      underscored: true,
      timestamps: true,
    }
  );

  return Lookup;
};
