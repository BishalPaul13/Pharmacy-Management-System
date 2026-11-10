const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { getDb } = require('../config/db');

function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication token is required to access this resource',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDb();
    const user = db.prepare('SELECT id, username, full_name, role, email, is_active FROM users WHERE id = ?').get(decoded.id);

    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User account is inactive or no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token',
    });
  }
}

module.exports = { authenticate };
