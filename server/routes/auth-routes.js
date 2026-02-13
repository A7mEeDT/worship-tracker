import { Router } from "express";
import { ADMIN_ROLES } from "../constants.js";
import { AppError } from "../utils/errors.js";

export function createAuthRouter({
  credentialsService,
  authService,
  authMiddleware,
  twoFactorService,
  auditService,
  getRequestIpAddress,
}) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const username = String(req.body?.username ?? "");
      const password = String(req.body?.password ?? "");
      const otp = req.body?.otp;

      if (!username || !password) {
        throw new AppError(400, "Username and password are required.", "MISSING_CREDENTIALS");
      }

      const user = await credentialsService.authenticateUser(username, password);
      if (!user) {
        throw new AppError(401, "Invalid username or password.", "INVALID_CREDENTIALS");
      }

      let mfaVerified = false;
      if (ADMIN_ROLES.includes(user.role)) {
        const mfaEnabled = await twoFactorService.hasTwoFactorEnabled(user.username);
        if (mfaEnabled) {
          if (!otp) {
            throw new AppError(401, "Two-factor code is required.", "TOTP_REQUIRED");
          }

          await twoFactorService.verifyTwoFactorForLogin(user.username, otp);
          mfaVerified = true;
        }
      }

      const token = authService.createSessionToken({ username: user.username, mfaVerified });
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
