const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelizeConfig = require('../config/sequelize.config');
const { env } = require('../config/env');
const logger = require('../config/logger');

const config = sequelizeConfig[env];
const basename = path.basename(__filename);

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: (msg) => logger.debug(msg),
});

const db = {};

// Auto-discovers every *.model.js file in this directory instead of requiring
// each one by hand, so adding a new model is just "drop a file in here".
fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.model.js'))
  .forEach((file) => {
    const modelDefiner = require(path.join(__dirname, file));
    const model = modelDefiner(sequelize, DataTypes);
    db[model.name] = model;
  });

// Association setup runs in a second pass, after all models are registered in
// `db`, so a model can reference any other model (e.g. Workflow.hasMany(db.Task))
// regardless of file load order.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
