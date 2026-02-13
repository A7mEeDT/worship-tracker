import { Router } from "express";
import { ADMIN_ROLES } from "../constants.js";
import { AppError } from "../utils/errors.js";

function parseGroupId(value) {
  return String(value ?? "").trim();
}

export function createAdminQuestionRouter({
  authMiddleware,
  questionService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);
  router.use(authMiddleware.requireRoles(...ADMIN_ROLES));

  router.get("/groups", async (_req, res, next) => {
    try {
      const groups = await questionService.listGroupsForAdmin();
      res.json({ groups });
    } catch (error) {
      next(error);
    }
  });

  router.post("/groups", async (req, res, next) => {
    try {
      const group = await questionService.createGroup({
        title: req.body?.title,
        durationSeconds: req.body?.durationSeconds,
        questions: req.body?.questions,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_create_group:${group.id}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({ group });
    } catch (error) {
      next(error);
    }
  });

  router.put("/groups/:groupId", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const group = await questionService.updateGroup({
        groupId,
        title: req.body?.title,
        durationSeconds: req.body?.durationSeconds,
        questions: req.body?.questions,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_update_group:${groupId}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ group });
    } catch (error) {
      next(error);
    }
  });

  router.post("/groups/:groupId/open", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const group = await questionService.openGroup({ groupId });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_open_group:${groupId}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ group });
    } catch (error) {
      next(error);
    }
  });

  router.post("/groups/:groupId/lock", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const group = await questionService.lockGroup({ groupId });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_lock_group:${groupId}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ group });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/groups/:groupId/submissions", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const removed = await questionService.clearGroupResults({ groupId });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_clear_results:${groupId}:sub_${removed.submissions}:sess_${removed.sessions}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ removed });
    } catch (error) {
      next(error);
    }
  });

  router.post("/groups/:groupId/archive", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const moved = await questionService.archiveGroup({ groupId });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_archive_group:${groupId}:sub_${moved.submissions}:sess_${moved.sessions}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ moved });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/groups/:groupId", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const removed = await questionService.deleteGroup({ groupId });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_delete_group:${groupId}:sub_${removed.submissions}:sess_${removed.sessions}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/groups/:groupId/submissions", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const submissions = await questionService.listSubmissionsForAdmin({ groupId });
      res.json({ submissions });
    } catch (error) {
      next(error);
    }
  });

  router.get("/groups/:groupId/submissions/export.csv", async (req, res, next) => {
    try {
      const groupId = parseGroupId(req.params.groupId);
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const csv = await questionService.exportSubmissionsCsv({ groupId });
      const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
      const fileName = `question-results-${timestamp}.csv`;

      await auditService.recordUserAction({
        username: req.user.username,
        action: `admin_questions_export:${groupId}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
