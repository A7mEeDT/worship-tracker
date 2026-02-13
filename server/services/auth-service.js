import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AUTH_COOKIE_NAME } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { getUserByUsername } from "./credential-service.js";

function parseBearerToken(headerValue) {
  if (!headerValue) {
    return null;
  }

  const value = String(headerValue);
  const [prefix, token] = value.split(" ");

  if (prefix?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function createSessionToken({ username, mfaVerified = false }) {
  return jwt.sign(
    {
      sub: username,
      typ: "session",
      mfa: Boolean(mfaVerified),
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      issuer: "html-link-guru",
    },
  );
}

export function extractTokenFromRequest(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  const bearerToken = parseBearerToken(req.headers.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  return null;
}

export async function authenticateToken(token) {
  if (!token) {
    throw new AppError(401, "Authentication token is missing.", "MISSING_TOKEN");
  }

  let payload;

  try {
    payload = jwt.verify(token, config.jwtSecret, { issuer: "html-link-guru" });
  } catch {
    throw new AppError(401, "Session is invalid or expired.", "INVALID_TOKEN");
  }

  const username = String(payload?.sub ?? "").toLowerCase();
  if (!username) {
    throw new AppError(401, "Session payload is invalid.", "INVALID_TOKEN_PAYLOAD");
  }

  const user = await getUserByUsername(username);
  if (!user || !user.isActive) {
    throw new AppError(401, "User is inactive or does not exist.", "USER_NOT_AVAILABLE");
  }

  return {
    username: user.username,
    role: user.role,
    mfaVerified: Boolean(payload?.mfa),
  };
}

export async function authenticateFromRequest(req) {
  const token = extractTokenFromRequest(req);
  return authenticateToken(token);
}

export function setSessionCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.sessionMaxAgeMs,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  });
}
