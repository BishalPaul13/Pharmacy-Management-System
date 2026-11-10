/**
 * Server-side Role-Based Access Control (RBAC) middleware
 * Enforces role checks on the server so that operational permissions
 * cannot be bypassed by manipulating client-side state or UI elements.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required prior to permission evaluation',
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Action requires one of [${allowedRoles.join(', ')}], but current user role is '${req.user.role}'`,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

module.exports = { authorize };
