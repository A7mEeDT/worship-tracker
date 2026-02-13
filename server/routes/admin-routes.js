import { Router } from "express";
import { config } from "../config.js";
import { ADMIN_ROLES, Roles } from "../constants.js";
import {
  getActivityTimeline,
  getPerUserDistribution,
  parseDashboardWindow,
} from "../services/analytics-service.js";
import { runBackupOnce } from "../services/backup-service.js";
import { createAuditLogService } from "../services/audit-log-service.js";
import { getActivityLogPath } from "../services/activity-service.js";
import { getStorageOverview } from "../services/storage-service.js";
import { AppError } from "../utils/errors.js";

function parseLimit(rawLimit, fallback = 100, max = 500) {
  const value = Number(rawLimit);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(Math.trunc(value), max);
}

const AUDIT_LOG_TYPES = new Set(["user_activity", "admin_notifications"]);

export function createAdminRouter({
  authMiddleware,
  authService,
  credentialsService,
  notificationService,
  twoFactorService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  const auditLogService = createAuditLogService({
    activityLogPath: getActivityLogPath(),
    notificationsLogPath: notificationService.getNotificationsLogPath(),
  });

  router.use(authMiddleware.authenticateRequest);
  router.use(authMiddleware.requireRoles(...ADMIN_ROLES));

  router.get("/security/2fa/status", async (req, res, next) => {
    try {
      const status = await twoFactorService.getTwoFactorStatus(req.user.username);
      res.json({ ...status, enforce: config.admin2faEnforce });
    } catch (error) {
      next(error);
    }
  });

  router.post("/security/2fa/setup", async (req, res, next) => {
    try {
      const setup = await twoFactorService.beginTwoFactorSetup(req.user.username);

      await auditService.recordUserAction({
        username: req.user.username,
        action: "admin_2fa_setup",
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json(setup);
    } catch (error) {
      next(error);
    }
  });

  router.post("/security/2fa/verify", async (req, res, next) => {
    try {
      const otp = req.body?.otp;
      const result = await twoFactorService.enableTwoFactor(req.user.username, otp);

      // Refresh session cookie with a token that is marked MFA verified.
      const token = authService.createSessionToken({ username: req.user.username, mfaVerified: true });
      authService.setSessionCookie(res, token);

      await auditService.recordUserAction({
        username: req.user.username,
        action: "admin_2fa_enable",
        ipAddress: getRequestIpAddress(req),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/security/2fa/cancel", async (req, res, next) => {
    try {
      const result = await twoFactorService.cancelTwoFactorSetup(req.user.username);

      await auditService.recordUserAction({
        username: req.user.username,
        action: "admin_2fa_cancel",
        ipAddress: getRequestIpAddress(req),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/security/2fa/disable", async (req, res, next) => {
    try {
      const password = String(req.body?.password ?? "");
      const otp = req.body?.otp;

      if (!password) {
        throw new AppError(400, "Password is required.", "MISSING_PASSWORD");
      }

      const verified = await credentialsService.authenticateUser(req.user.username, password);
      if (!verified) {
        throw new AppError(401, "Invalid username or password.", "INVALID_CREDENTIALS");
      }

      const result = await twoFactorService.disableTwoFactor(req.user.username, otp);

      // Clear MFA flag from token on disable (no longer relevant).
      const token = authService.createSessionToken({ username: req.user.username, mfaVerified: false });
      authService.setSessionCookie(res, token);

      await auditService.recordUserAction({
        username: req.user.username,
        action: "admin_2fa_disable",
        ipAddress: getRequestIpAddress(req),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/security/2fa/reset", authMiddleware.requireRoles(Roles.PRIMARY_ADMIN), async (req, res, next) => {
    try {
      const targetUsername = req.body?.username;
      if (!targetUsername) {
        throw new AppError(400, "Target username is required.", "MISSING_TARGET_USERNAME");
      }

      const result = await twoFactorService.resetTwoFactor(targetUsername);

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_2fa_reset:${String(targetUsername).toLowerCase()}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  if (config.admin2faEnforce) {
    router.use(async (req, _res, next) => {
      try {
        const enabled = await twoFactorService.hasTwoFactorEnabled(req.user.username);
        if (!enabled) {
          next(new AppError(403, "Admin must enable two-factor authentication.", "ADMIN_2FA_SETUP_REQUIRED"));
          return;
        }

        if (!req.user.mfaVerified) {
          next(new AppError(401, "Two-factor authentication is required.", "MFA_REQUIRED"));
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    });
  }

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

  router.get("/audit/logs", async (req, res, next) => {
    try {
      const type = String(req.query.type ?? "").trim();
      if (!AUDIT_LOG_TYPES.has(type)) {
        throw new AppError(400, "Invalid audit log type.", "INVALID_AUDIT_TYPE");
      }
      const limit = parseLimit(req.query.limit, 200, 1000);
      const scanLimit = parseLimit(req.query.scanLimit, Math.max(500, limit * 5), 20000);

      const entries = await auditLogService.listAuditEntries({
        type,
        limit,
        scanLimit,
        username: req.query.username,
        actionContains: req.query.action,
        from: req.query.from,
        to: req.query.to,
        before: req.query.before,
      });

      res.json({ entries });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit/logs/export.csv", async (req, res, next) => {
    try {
      const type = String(req.query.type ?? "").trim();
      if (!AUDIT_LOG_TYPES.has(type)) {
        throw new AppError(400, "Invalid audit log type.", "INVALID_AUDIT_TYPE");
      }
      const limit = parseLimit(req.query.limit, 2000, 20000);
      const scanLimit = parseLimit(req.query.scanLimit, Math.max(500, limit * 2), 20000);

      const csv = await auditLogService.exportAuditCsv({
        type,
        limit,
        scanLimit,
        username: req.query.username,
        actionContains: req.query.action,
        from: req.query.from,
        to: req.query.to,
        before: req.query.before,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
      const fileName = `audit-${type || "log"}-${timestamp}.csv`;

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_audit_export:${type || "unknown"}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.get("/system/storage", async (req, res, next) => {
    try {
      const overview = await getStorageOverview({ dataDir: config.dataDir });

      await auditService.recordUserAction({
        username: req.user.username,
        action: "admin_system_storage_view",
        ipAddress: getRequestIpAddress(req),
      });

      res.json({
        overview,
        backupConfig: {
          enabled: config.backupEnabled,
          intervalMs: config.backupIntervalMs,
          retentionDays: config.backupRetentionDays,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/system/backups/run", async (req, res, next) => {
    try {
      const result = await runBackupOnce({
        dataDir: config.dataDir,
        retentionDays: config.backupRetentionDays,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_system_backup_run:copied_${result.copied}:pruned_${result.pruned}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({ result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
