import { Router } from "express";
import { AppError } from "../utils/errors.js";

function sanitizeAnswersPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    const questionId = String(key ?? "").trim().slice(0, 80);
    if (!questionId) {
      continue;
    }
    result[questionId] = typeof value === "string" ? value : String(value ?? "");
  }

  return result;
}

export function createQuestionRouter({
  authMiddleware,
  questionService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);

  router.get("/active", async (req, res, next) => {
    try {
      const response = await questionService.getActiveGroupForUser({ username: req.user.username });
      res.json({
        serverTime: new Date().toISOString(),
        group: response.group,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:groupId/submit", async (req, res, next) => {
    try {
      const groupId = String(req.params.groupId ?? "").trim();
      if (!groupId) {
        throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
      }

      const answersById = sanitizeAnswersPayload(req.body?.answers);
      const submission = await questionService.submitAnswers({
        groupId,
        username: req.user.username,
        answersById,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `questions_submit:${groupId}:score_${submission.score}_${submission.maxScore}`,
        ipAddress: getRequestIpAddress(req),
      });

      res.status(201).json({
        submission: {
          id: submission.id,
          groupId: submission.groupId,
          username: submission.username,
          score: submission.score,
          maxScore: submission.maxScore,
          submittedAt: submission.submittedAt,
          durationMs: submission.durationMs,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

