import fs from "node:fs/promises";
import path from "node:path";
import { ensureFile } from "../utils/file-store.js";

function sanitizeText(value, maxLength = 300) {
  return String(value ?? "")
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(parsed), max);
}

function timestampToDate(timestamp) {
  const raw = String(timestamp ?? "").trim();
  if (!raw) {
    return null;
  }

  // Stored format: "YYYY-MM-DD HH:mm:ss" (local time).
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function tailLines(filePath, limit, { maxBytes = 4 * 1024 * 1024 } = {}) {
  await ensureFile(filePath);

  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const stat = await handle.stat();
    if (!stat.size) {
      return [];
    }

    const chunkSize = 64 * 1024;
    const targetNewlines = Math.max(50, limit + 5);

    let position = stat.size;
    let bytesScanned = 0;
    let newlineCount = 0;
    let buffer = "";

    while (position > 0 && newlineCount < targetNewlines && bytesScanned < maxBytes) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;

      const chunkBuffer = Buffer.alloc(readSize);
      const result = await handle.read(chunkBuffer, 0, readSize, position);
      const text = chunkBuffer.toString("utf8", 0, result.bytesRead);

      bytesScanned += result.bytesRead;
      newlineCount += (text.match(/\n/gu) ?? []).length;
      buffer = text + buffer;
    }

    const lines = buffer
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.slice(-limit);
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}

function parseSegments(line, expectedSegments) {
  const parts = String(line ?? "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (parts.length < expectedSegments) {
    return null;
  }

  if (parts.length === expectedSegments) {
    return parts;
  }

  // Defensive: merge extra segments into the last field.
  return [...parts.slice(0, expectedSegments - 1), parts.slice(expectedSegments - 1).join(" ")];
}

function csvEscape(value) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/gu, "\"\"")}"`;
}

export function createAuditLogService({ activityLogPath, notificationsLogPath }) {
  const activityPath = path.resolve(activityLogPath);
  const notificationsPath = path.resolve(notificationsLogPath);

  async function listAuditEntries({
    type,
    limit = 200,
    scanLimit = 2000,
    username,
    actionContains,
    from,
    to,
    before,
  }) {
    const safeType = String(type ?? "").trim();
    if (!["user_activity", "admin_notifications"].includes(safeType)) {
      throw new Error("Invalid audit log type.");
    }

    const safeLimit = parsePositiveInt(limit, 200, 1000);
    const safeScanLimit = parsePositiveInt(scanLimit, Math.max(500, safeLimit * 5), 20000);

    const usernameFilter = username ? sanitizeText(username, 100).toLowerCase() : "";
    const actionFilter = actionContains ? sanitizeText(actionContains, 200).toLowerCase() : "";

    const fromDate = from ? timestampToDate(from) : null;
    const toDate = to ? timestampToDate(to) : null;
    const beforeDate = before ? timestampToDate(before) : null;

    const filePath = safeType === "user_activity" ? activityPath : notificationsPath;
    const lines = await tailLines(filePath, safeScanLimit);

    const parsed = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const segments = parseSegments(line, 4);
      if (!segments) {
        continue;
      }

      const [timestamp, actorUsername, action, fourth] = segments;
      const when = timestampToDate(timestamp);
      if (!when) {
        continue;
      }

      if (beforeDate && when >= beforeDate) {
        continue;
      }

      if (fromDate && when < fromDate) {
        continue;
      }

      if (toDate && when > toDate) {
        continue;
      }

      const safeUsername = sanitizeText(actorUsername, 100).toLowerCase();
      const safeAction = sanitizeText(action, 400);

      if (usernameFilter && safeUsername !== usernameFilter) {
        continue;
      }

      if (actionFilter && !safeAction.toLowerCase().includes(actionFilter)) {
        continue;
      }

      if (safeType === "user_activity") {
        parsed.push({
          id: `ua_${timestamp}_${safeUsername}_${i}`,
          type: safeType,
          timestamp,
          username: safeUsername,
          action: safeAction,
          ipAddress: sanitizeText(fourth, 120),
        });
      } else {
        parsed.push({
          id: `an_${timestamp}_${safeUsername}_${i}`,
          type: safeType,
          timestamp,
          username: safeUsername,
          action: safeAction,
          admin: sanitizeText(fourth, 100).toLowerCase(),
        });
      }
    }

    parsed.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return parsed.slice(0, safeLimit);
  }

  async function exportAuditCsv(params) {
    const type = String(params?.type ?? "").trim();
    const entries = await listAuditEntries(params);

    if (type === "admin_notifications") {
      const header = ["timestamp", "username", "action", "admin"].map(csvEscape).join(",");
      const rows = entries.map((entry) =>
        [entry.timestamp, entry.username, entry.action, entry.admin].map(csvEscape).join(","),
      );
      return `\uFEFF${header}\n${rows.join("\n")}\n`;
    }

    const header = ["timestamp", "username", "action", "ipAddress"].map(csvEscape).join(",");
    const rows = entries.map((entry) =>
      [entry.timestamp, entry.username, entry.action, entry.ipAddress].map(csvEscape).join(","),
    );
    return `\uFEFF${header}\n${rows.join("\n")}\n`;
  }

  return {
    listAuditEntries,
    exportAuditCsv,
  };
}

