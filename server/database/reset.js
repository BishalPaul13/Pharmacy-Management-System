const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { closeDb } = require('../config/db');
const { seedDatabase } = require('./seed');

function resetDatabase() {
  console.log('Resetting database...');
  closeDb();

  if (fs.existsSync(config.dbPath)) {
    try {
      fs.unlinkSync(config.dbPath);
      console.log(`Deleted existing database at ${config.dbPath}`);
    } catch (e) {
      console.warn('Could not delete db file directly, proceeding with seed clear:', e.message);
    }
  }

  seedDatabase();
  console.log('Database reset and seeded successfully.');
}

if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };

