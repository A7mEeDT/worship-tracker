import { AppError } from "../utils/errors.js";

export function createAuthMiddleware({ authenticateFromRequest }) {
  async function authenticateRequest(req, _res, next) {
    try {
      req.user = await authenticateFromRequest(req);
      next();
    } catch (error) {
      next(error);
    }
  }

  async function optionalAuthenticate(req, _res, next) {
    try {
      req.user = await authenticateFromRequest(req);
    } catch {
      req.user = null;
    }

    next();
  }

  function requireRoles(...roles) {
    return (req, _res, next) => {
      if (!req.user) {
        next(new AppError(401, "Authentication required.", "AUTH_REQUIRED"));
        return;
      }

      if (!roles.includes(req.user.role)) {
        next(new AppError(403, "Insufficient permissions.", "FORBIDDEN"));
        return;
      }

      next();
    };
  }

  return {
    authenticateRequest,
    optionalAuthenticate,
    requireRoles,
  };
}
