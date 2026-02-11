import { Router } from "express";
import { AppError } from "../utils/errors.js";

function sanitizeAction(action) {
  return String(action ?? "")
    .trim()
    .slice(0, 180);
}

export function createActivityRouter({ authMiddleware, auditService, getRequestIpAddress }) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);

  router.post("/action", async (req, res, next) => {
    try {
      const action = sanitizeAction(req.body?.action);
      if (!action) {
        throw new AppError(400, "Action is required.", "MISSING_ACTION");
      }

      await auditService.recordUserAction({
        username: req.user.username,
        action,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/page-access", async (req, res, next) => {
    try {
      const path = String(req.body?.path ?? "")
        .trim()
        .slice(0, 120);

      if (!path) {
        throw new AppError(400, "Path is required.", "MISSING_PATH");
      }

      await auditService.recordUserAction({
        username: req.user.username,
        action: `page_access:${path}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
