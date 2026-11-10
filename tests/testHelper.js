const request = require('supertest');
const { getDb, closeDb } = require('../server/config/db');
const { seedDatabase } = require('../server/database/seed');
const app = require('../server/app');

function setupTestDatabase() {
  const db = getDb(':memory:');
  seedDatabase(db);
  return db;
}

function cleanupTestDatabase() {
  closeDb();
}

async function getAuthTokens() {
  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'admin123' });

  const pharmRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'pharmacist', password: 'pharm123' });

  const cashRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'cashier', password: 'cash123' });

  return {
    adminToken: adminRes.body.data.token,
    pharmToken: pharmRes.body.data.token,
    cashierToken: cashRes.body.data.token,
  };
}

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  getAuthTokens,
};

