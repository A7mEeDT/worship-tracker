import { Router } from "express";

export function createGoalsRouter({ authMiddleware, goalsService }) {
  const router = Router();

  router.use(authMiddleware.authenticateRequest);

  router.get("/", async (_req, res, next) => {
    try {
      const goals = await goalsService.getGlobalGoals();
      res.json({ goals });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

