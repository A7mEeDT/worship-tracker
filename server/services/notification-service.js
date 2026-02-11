import path from "node:path";
import { WebSocketServer } from "ws";
import { config } from "../config.js";
import { AUTH_COOKIE_NAME, FILE_NAMES } from "../constants.js";
import { appendLine, ensureFile, readLines } from "../utils/file-store.js";
import { formatLogTimestamp } from "./activity-service.js";

const notificationsLogPath = path.join(config.dataDir, FILE_NAMES.ADMIN_NOTIFICATIONS);

function sanitizeSegment(value) {
  return String(value ?? "")
    .replace(/[\r\n,]+/gu, " ")
    .trim();
}

function parseCookieHeader(cookieHeader) {
  const result = {};

  // Parse raw Cookie header without depending on Express middleware in WS upgrades.
  for (const pair of String(cookieHeader ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    result[key] = decodeURIComponent(value);
  }

  return result;
}

function parseLogLine(line, index) {
  const parts = line.split(",").map((segment) => segment.trim());
  if (parts.length < 4) {
    return null;
  }

  const [timestamp, username, action, admin] = parts;
  return {
    id: `${timestamp}-${username}-${index}`,
    timestamp,
    username,
    action,
    admin,
  };
}

export function createNotificationService({ authenticateToken, listAdminUsernames }) {
  const wsByAdmin = new Map();

  async function initialize() {
    await ensureFile(notificationsLogPath);
  }

  function registerSocket(username, socket) {
    if (!wsByAdmin.has(username)) {
      wsByAdmin.set(username, new Set());
    }

    wsByAdmin.get(username).add(socket);
  }

  function unregisterSocket(username, socket) {
    const socketSet = wsByAdmin.get(username);
    if (!socketSet) {
      return;
    }

    socketSet.delete(socket);
    if (!socketSet.size) {
      wsByAdmin.delete(username);
    }
  }

  async function attachWebSocketServer(httpServer) {
    const wss = new WebSocketServer({
      server: httpServer,
      path: "/ws/admin-notifications",
    });

    wss.on("connection", async (socket, request) => {
      try {
        const cookies = parseCookieHeader(request.headers.cookie);
        const token = cookies[AUTH_COOKIE_NAME];
        const user = await authenticateToken(token);

        if (!["primary_admin", "admin"].includes(user.role)) {
          socket.close(1008, "Forbidden");
          return;
        }

        registerSocket(user.username, socket);

        socket.send(
          JSON.stringify({
            type: "connected",
            timestamp: formatLogTimestamp(new Date()),
          }),
        );

        socket.on("close", () => unregisterSocket(user.username, socket));
      } catch {
        socket.close(1008, "Unauthorized");
      }
    });
  }

  async function recordActivityNotification({ username, action, timestamp = new Date() }) {
    const adminUsernames = await listAdminUsernames();

    if (!adminUsernames.length) {
      return;
    }

    const formattedTimestamp = formatLogTimestamp(timestamp);
    const actorUsername = sanitizeSegment(username);
    const safeAction = sanitizeSegment(action);

    await Promise.all(
      adminUsernames.map((adminUsername) =>
        appendLine(
          notificationsLogPath,
          `${formattedTimestamp}, ${actorUsername}, ${safeAction}, ${sanitizeSegment(adminUsername)}`,
        ),
      ),
    );

    const payloadByAdmin = new Map();

    // We persist one notification entry per admin recipient for auditability.
    for (const adminUsername of adminUsernames) {
      const notification = {
        id: `${formattedTimestamp}-${actorUsername}-${adminUsername}`,
        timestamp: formattedTimestamp,
        username: actorUsername,
        action: safeAction,
        admin: adminUsername,
      };
      payloadByAdmin.set(adminUsername, JSON.stringify({ type: "activity", notification }));
    }

    for (const [adminUsername, sockets] of wsByAdmin.entries()) {
      const payload = payloadByAdmin.get(adminUsername);
      if (!payload) {
        continue;
      }

      for (const socket of sockets) {
        if (socket.readyState === 1) {
          socket.send(payload);
        }
      }
    }
  }

  async function getNotificationsForAdmin({ adminUsername, limit = 100, since }) {
    const lines = await readLines(notificationsLogPath);
    const parsed = lines.map(parseLogLine).filter(Boolean);

    const sinceDate = since ? new Date(since) : null;
    const filtered = parsed.filter((entry) => {
      if (entry.admin !== adminUsername) {
        return false;
      }

      if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
        return true;
      }

      const entryDate = new Date(entry.timestamp.replace(" ", "T"));
      return entryDate > sinceDate;
    });

    return filtered.slice(-limit).reverse();
  }

  function getNotificationsLogPath() {
    return notificationsLogPath;
  }

  return {
    initialize,
    attachWebSocketServer,
    recordActivityNotification,
    getNotificationsForAdmin,
    getNotificationsLogPath,
  };
}
