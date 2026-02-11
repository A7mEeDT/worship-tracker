import { Router } from "express";
import { AppError } from "../utils/errors.js";

function buildCsvFilename(windowKey) {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return `reports-${windowKey}-${timestamp}.csv`;
}

export function createReportRouter({
  authMiddleware,
  reportService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);

  router.post("/", async (req, res, next) => {
    try {
      const report = await reportService.upsertUserReport({
        username: req.user.username,
        payload: req.body,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `report_saved:${report.date}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({ report });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const window = String(req.query.window ?? "all");
      const usernameFilter = req.query.username ? String(req.query.username) : null;

      const reports = await reportService.listReports({
        requester: req.user,
        window,
        usernameFilter,
      });

      res.json({
        window,
        reports,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/export.csv", async (req, res, next) => {
    try {
      const window = String(req.query.window ?? "all");
      const usernameFilter = req.query.username ? String(req.query.username) : null;

      const reports = await reportService.listReports({
        requester: req.user,
        window,
        usernameFilter,
      });

      const csv = reportService.reportsToCsv(reports);
      const fileName = buildCsvFilename(window);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/", async (req, res, next) => {
    try {
      await reportService.clearReportsForRequester({
        requester: req.user,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: "report_clear_mine",
        ipAddress: getRequestIpAddress(req),
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:username", authMiddleware.requireRoles("admin", "primary_admin"), async (req, res, next) => {
    try {
      const username = String(req.params.username ?? "").trim().toLowerCase();
      if (!username) {
        throw new AppError(400, "Username is required.", "MISSING_USERNAME");
      }

      await reportService.clearReportsByUsername(username);

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_report_clear_user:${username}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
