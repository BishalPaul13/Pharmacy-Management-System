const path = require('path');
require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'pharmacy_super_secure_jwt_secret_token_2026',
  jwtExpiresIn: '24h',
  dbPath: process.env.DATABASE_PATH || path.join(__dirname, '../database/pharmacy.db'),
  taxRate: parseFloat(process.env.TAX_RATE || '10'),
  expiryAlertDays: parseInt(process.env.EXPIRY_ALERT_DAYS || '60', 10),
  reorderAlertDefault: parseInt(process.env.REORDER_ALERT_DEFAULT || '15', 10),
};

module.exports = config;
