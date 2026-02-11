import { Router } from "express";
import { ADMIN_ROLES } from "../constants.js";
import { AppError } from "../utils/errors.js";

export function createWirdConfigRouter({
  authMiddleware,
  wirdConfigService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);

  router.get("/", async (_req, res, next) => {
    try {
      const wirds = await wirdConfigService.getWirdConfig();
      res.json({ wirds });
    } catch (error) {
      next(error);
    }
  });

  router.put("/", authMiddleware.requireRoles(...ADMIN_ROLES), async (req, res, next) => {
    try {
      const rawWirds = req.body?.wirds;
      if (!Array.isArray(rawWirds)) {
        throw new AppError(400, "Body must include 'wirds' array.", "MISSING_WIRDS");
      }

      const wirds = await wirdConfigService.updateWirdConfig(rawWirds);

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_update_wird_config:${wirds.length}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ wirds });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
