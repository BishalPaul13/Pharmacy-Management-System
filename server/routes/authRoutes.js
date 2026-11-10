const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const authService = require('../services/authService');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', validate(loginSchema), (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const result = authService.login(username, password, ip);
    res.json({
      success: true,
      message: 'Authentication successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

module.exports = router;
