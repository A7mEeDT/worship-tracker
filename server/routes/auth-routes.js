import { Router } from "express";
import { AppError } from "../utils/errors.js";

export function createAuthRouter({
  credentialsService,
  authService,
  authMiddleware,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const username = String(req.body?.username ?? "");
      const password = String(req.body?.password ?? "");

      if (!username || !password) {
        throw new AppError(400, "Username and password are required.", "MISSING_CREDENTIALS");
      }

      const user = await credentialsService.authenticateUser(username, password);
      if (!user) {
        throw new AppError(401, "Invalid username or password.", "INVALID_CREDENTIALS");
      }

      const token = authService.createSessionToken(user);
      authService.setSessionCookie(res, token);

      await auditService.recordUserAction({
        username: user.username,
        action: "login",
        ipAddress: getRequestIpAddress(req),
      });

      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", authMiddleware.optionalAuthenticate, async (req, res, next) => {
    try {
      const user = req.user;
      authService.clearSessionCookie(res);

      if (user) {
        await auditService.recordUserAction({
          username: user.username,
          action: "logout",
          ipAddress: getRequestIpAddress(req),
        });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authMiddleware.authenticateRequest, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
