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
    data: {
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.full_name,
      full_name: req.user.full_name,
      role: req.user.role,
      email: req.user.email,
      phone: req.user.phone,
    },
  });
});

module.exports = router;
