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
        alreadySubmitted: Boolean(response.alreadySubmitted),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:groupId/submit", async (req, res, next) => {
    const groupId = String(req.params.groupId ?? "").trim();
    const ipAddress = getRequestIpAddress(req);

    if (!groupId) {
      next(new AppError(400, "Group ID is required.", "MISSING_GROUP_ID"));
      return;
    }

    try {
      const answersById = sanitizeAnswersPayload(req.body?.answers);
      const submission = await questionService.submitAnswers({
        groupId,
        username: req.user.username,
        answersById,
      });

      await auditService.recordUserAction({
        username: req.user.username,
        action: `questions_submit:${groupId}:score_${submission.score}_${submission.maxScore}`,
        ipAddress,
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
      // Anti-cheat auditing: log rejected attempts (duplicate submit or submit after close/timeout).
      if (error instanceof AppError && ["GROUP_CLOSED", "ALREADY_SUBMITTED"].includes(error.code)) {
        try {
          await auditService.recordUserAction({
            username: req.user.username,
            action: `questions_submit_rejected:${groupId}:${error.code.toLowerCase()}`,
            ipAddress,
          });
        } catch {
          // Avoid masking the original error.
        }
      }

      next(error);
    }
  });

  return router;
}
