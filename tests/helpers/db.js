const { sequelize } = require('../../src/models');

// roles/permissions/lookup are seeded once by globalSetup and left alone -
// only the tables a test can actually mutate get wiped between tests.
// RESTART IDENTITY keeps IDs predictable across tests that assert on them.
const resetMutableTables = async () => {
  await sequelize.query(
    'TRUNCATE TABLE refresh_tokens, token_families, sessions, user_roles, users, user_teams, teams RESTART IDENTITY CASCADE'
  );
};

module.exports = { sequelize, resetMutableTables };
