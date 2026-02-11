import path from "node:path";
import { config } from "../config.js";
import { FILE_NAMES } from "../constants.js";
import { appendLine, ensureFile } from "../utils/file-store.js";

const activityLogPath = path.join(config.dataDir, FILE_NAMES.USER_ACTIVITY_LOG);

function pad(value) {
  return String(value).padStart(2, "0");
}

function sanitizeSegment(value) {
  return String(value ?? "")
    .replace(/[\r\n,]+/gu, " ")
    .trim();
}

export function formatLogTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getRequestIpAddress(req) {
  const forwardedHeader = req.headers["x-forwarded-for"];

  if (typeof forwardedHeader === "string" && forwardedHeader.length > 0) {
    return forwardedHeader.split(",")[0].trim();
  }

  if (Array.isArray(forwardedHeader) && forwardedHeader.length > 0) {
    return forwardedHeader[0].split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

export async function initializeActivityLog() {
  await ensureFile(activityLogPath);
}

export async function logUserActivity({ username, action, ipAddress, timestamp = new Date() }) {
  const line = `${formatLogTimestamp(timestamp)}, ${sanitizeSegment(username)}, ${sanitizeSegment(action)}, ${sanitizeSegment(ipAddress || "unknown")}`;
  await appendLine(activityLogPath, line);
}

export function getActivityLogPath() {
  return activityLogPath;
}
