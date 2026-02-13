import http from "node:http";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { createAuthMiddleware } from "./middleware/auth-middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error-middleware.js";
import { createActivityRouter } from "./routes/activity-routes.js";
import { createAdminRouter } from "./routes/admin-routes.js";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createReportRouter } from "./routes/report-routes.js";
import { createQuestionRouter } from "./routes/question-routes.js";
import { createAdminQuestionRouter } from "./routes/admin-question-routes.js";
import { createWirdConfigRouter } from "./routes/wird-config-routes.js";
import { createAuditService } from "./services/audit-service.js";
import { getRequestIpAddress, initializeActivityLog } from "./services/activity-service.js";
import * as authService from "./services/auth-service.js";
import * as credentialsService from "./services/credential-service.js";
import { createNotificationService } from "./services/notification-service.js";
import { startBackupScheduler } from "./services/backup-service.js";
import * as twoFactorService from "./services/twofactor-service.js";
import * as questionService from "./services/question-service.js";
import * as reportService from "./services/report-service.js";
import * as wirdConfigService from "./services/wird-config-service.js";

const app = express();
const server = http.createServer(app);

await credentialsService.initializeCredentialStore();
await twoFactorService.initializeTwoFactorStore();
await initializeActivityLog();
await wirdConfigService.initializeWirdConfigStore();
await reportService.initializeReportStore();
await questionService.initializeQuestionStore();

const notificationService = createNotificationService({
  authenticateToken: authService.authenticateToken,
  listAdminUsernames: credentialsService.listAdminUsernames,
});

await notificationService.initialize();
await notificationService.attachWebSocketServer(server);

const auditService = createAuditService({ notificationService });
const authMiddleware = createAuthMiddleware({
  authenticateFromRequest: authService.authenticateFromRequest,
});

startBackupScheduler({
  enabled: config.backupEnabled,
  dataDir: config.dataDir,
  intervalMs: config.backupIntervalMs,
  retentionDays: config.backupRetentionDays,
});

app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(cookieParser());
app.use(
  express.json({
    limit: "512kb",
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    at: new Date().toISOString(),
  });
});

app.use(
  "/api/auth",
  createAuthRouter({
    credentialsService,
    authService,
    authMiddleware,
    twoFactorService,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/activity",
  createActivityRouter({
    authMiddleware,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/admin",
  createAdminRouter({
    authMiddleware,
    authService,
    credentialsService,
    notificationService,
    twoFactorService,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/wird-config",
  createWirdConfigRouter({
    authMiddleware,
    wirdConfigService,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/reports",
  createReportRouter({
    authMiddleware,
    reportService,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/questions",
  createQuestionRouter({
    authMiddleware,
    questionService,
    auditService,
    getRequestIpAddress,
  }),
);

app.use(
  "/api/admin/questions",
  createAdminQuestionRouter({
    authMiddleware,
    questionService,
    auditService,
    getRequestIpAddress,
  }),
);

if (config.nodeEnv === "production") {
  const distPath = path.join(process.cwd(), "dist");

  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }

    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`);
  console.log(`Credential and logs directory: ${config.dataDir}`);
});
