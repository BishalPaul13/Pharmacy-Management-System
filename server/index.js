const app = require('./app');
const config = require('./config/config');
const { getDb } = require('./config/db');
const { runMigrations } = require('./database/migrate');
const { seedDatabase } = require('./database/seed');
const fs = require('fs');

// Ensure database is initialized
const dbFileExists = fs.existsSync(config.dbPath);
const db = getDb();

if (!dbFileExists) {
  console.log('Database not found. Initializing and running seeds...');
  runMigrations(db);
  seedDatabase(db);
}

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 Pharmacy Management System Backend is running!`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`📑 Interactive API Docs (Swagger): http://localhost:${config.port}/api/docs`);
  console.log(`🧪 Health Check: http://localhost:${config.port}/api/health`);
  console.log(`🔒 RBAC Roles: ADMIN, PHARMACIST, CASHIER`);
  console.log(`====================================================`);
});

module.exports = server;
