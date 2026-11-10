const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { getDb } = require('../config/db');
const { logAudit } = require('../middlewares/auditLogger');

function login(username, password, ip = '127.0.0.1') {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (user.is_active !== 1) {
    const err = new Error('User account is deactivated. Contact administrator.');
    err.statusCode = 403;
    err.code = 'ACCOUNT_DEACTIVATED';
    throw err;
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  logAudit({
    user,
    ip,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: user.id,
    details: { username: user.username, role: user.role },
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    },
  };
}

function getCurrentUser(userId) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, full_name, role, email, phone, is_active, created_at FROM users WHERE id = ?').get(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  return user;
}

module.exports = {
  login,
  getCurrentUser,
};
