require('dotenv').config();
const { Client } = require('pg');

// Wipes the test database's schema after the full run so the next run's
// globalSetup (migrate + seed) always starts from nothing - re-running the
// seeders against leftover data would fail on the roles/lookup unique constraints.
module.exports = async () => {
  const dbName = `${process.env.DB_NAME || 'workflow_tracking_api'}_test`;

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
};
