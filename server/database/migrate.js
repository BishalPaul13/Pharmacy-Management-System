const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/db');

function runMigrations(dbInstance = null) {
  const db = dbInstance || getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Running database migrations...');
  db.exec(schemaSql);
  console.log('Migrations executed successfully.');
}

if (require.main === module) {
  try {
    runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

module.exports = { runMigrations };
