import { Router } from "express";
import { ADMIN_ROLES, Roles } from "../constants.js";
import {
  getActivityTimeline,
  getPerUserDistribution,
  parseDashboardWindow,
} from "../services/analytics-service.js";
import { AppError } from "../utils/errors.js";

function parseLimit(rawLimit, fallback = 100, max = 500) {
  const value = Number(rawLimit);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(Math.trunc(value), max);
}

export function createAdminRouter({
  authMiddleware,
  credentialsService,
  notificationService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);
  router.use(authMiddleware.requireRoles(...ADMIN_ROLES));

  router.get("/analytics/timeline", async (req, res, next) => {
    try {
      const days = parseDashboardWindow(req.query.days);
      const timeline = await getActivityTimeline(days);
      res.json({ days, timeline });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics/per-user", async (req, res, next) => {
    try {
      const days = parseDashboardWindow(req.query.days);
      const distribution = await getPerUserDistribution(days);
      res.json({ days, distribution });
    } catch (error) {
      next(error);
    }
  });

  router.get("/users", async (_req, res, next) => {
    try {
      const users = await credentialsService.listUsers();
      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.get("/notifications", async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit);
      const since = req.query.since ? String(req.query.since) : null;

      const notifications = await notificationService.getNotificationsForAdmin({
        adminUsername: req.user.username,
        limit,
        since,
      });

      res.json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/users",
    authMiddleware.requireRoles(Roles.PRIMARY_ADMIN),
    async (req, res, next) => {
      try {
        const username = req.body?.username;
        const password = req.body?.password;
        const role = req.body?.role === Roles.ADMIN ? Roles.ADMIN : Roles.USER;

        const user = await credentialsService.createUser({ username, password, role });

        await auditService.recordUserAction({
          username: req.user.username,
          action: `admin_create_user:${user.username}:${role}`,
          ipAddress: getRequestIpAddress(req),
        });

        res.status(201).json({ user });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/users/:username",
    authMiddleware.requireRoles(Roles.PRIMARY_ADMIN),
    async (req, res, next) => {
      try {
        const targetUsername = decodeURIComponent(req.params.username);
        const password = typeof req.body?.password === "string" ? req.body.password : undefined;
        const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;

        const existing = await credentialsService.getUserByUsername(targetUsername);
        if (!existing) {
          throw new AppError(404, "User not found.", "USER_NOT_FOUND");
        }

        if (existing.role === Roles.PRIMARY_ADMIN) {
          throw new AppError(403, "Primary admin cannot be managed by this endpoint.", "PRIMARY_PROTECTED");
        }

        const updated = await credentialsService.updateUser({
          username: targetUsername,
          password,
          isActive,
        });

        await auditService.recordUserAction({
          username: req.user.username,
          action: `admin_update_user:${updated.username}`,
          ipAddress: getRequestIpAddress(req),
        });

        res.json({ user: updated });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/users/:username",
    authMiddleware.requireRoles(Roles.PRIMARY_ADMIN),
    async (req, res, next) => {
      try {
        const targetUsername = decodeURIComponent(req.params.username);

        const deleted = await credentialsService.deleteUser(targetUsername);

        await auditService.recordUserAction({
          username: req.user.username,
          action: `admin_delete_user:${deleted.username}`,
          ipAddress: getRequestIpAddress(req),
        });

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/users/:username/promote",
    authMiddleware.requireRoles(Roles.PRIMARY_ADMIN),
    async (req, res, next) => {
      try {
        const targetUsername = decodeURIComponent(req.params.username);

        const promoted = await credentialsService.promoteUserToAdmin(targetUsername);

        await auditService.recordUserAction({
          username: req.user.username,
          action: `admin_promote_user:${promoted.username}`,
          ipAddress: getRequestIpAddress(req),
        });

        res.json({ user: promoted });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
