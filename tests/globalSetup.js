require('dotenv').config();
const { execSync } = require('child_process');
const { Client } = require('pg');

// Runs once, in its own process, before any test file loads. Creates the
// dedicated *_test database (isolated from the dev DB) and brings it up to
// date via the real migrations/seeders - the same ones used in production -
// rather than re-deriving the schema some other way that could drift from it.
module.exports = async () => {
  const dbName = `${process.env.DB_NAME || 'workflow_tracking_api'}_test`;

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
  });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  execSync('npx sequelize-cli db:migrate --env test', { stdio: 'inherit' });
  execSync('npx sequelize-cli db:seed:all --env test', { stdio: 'inherit' });
};
