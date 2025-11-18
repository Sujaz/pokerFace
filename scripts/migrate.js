const { loadEnv } = require('../loadEnv');
const { ensureDatabase } = require('../db');

loadEnv();

ensureDatabase()
  .then(() => {
    console.log('Database schema ensured.');
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
