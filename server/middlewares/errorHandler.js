function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err);

  // Zod validation error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Request payload validation failed',
      details: err.errors ? err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })) : err.message,
    });
  }

  // SQLite Constraint Violations
  if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
    return res.status(422).json({
      success: false,
      error: 'ConstraintViolation',
      message: 'Database check constraint failed: stock cannot be negative or invalid data provided',
      details: err.message,
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      success: false,
      error: 'DuplicateEntry',
      message: 'A record with this identifier already exists (unique constraint violation)',
      details: err.message,
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({
      success: false,
      error: 'ForeignKeyViolation',
      message: 'Referenced entity does not exist or cannot be modified due to relational constraints',
      details: err.message,
    });
  }

  // Business logic errors thrown explicitly
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.code || 'BusinessRuleError',
      message: err.message,
      details: err.details || null,
    });
  }

  // Generic fallback 500
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}

module.exports = { errorHandler };
