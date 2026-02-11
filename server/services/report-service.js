import path from "node:path";
import { config } from "../config.js";
import { ADMIN_ROLES, FILE_NAMES } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const reportsPath = path.join(config.dataDir, FILE_NAMES.WORSHIP_REPORTS);
const ALLOWED_WINDOWS = new Set(["1d", "7d", "1w", "1m", "all"]);

function sanitizeText(value, maxLength = 200) {
  return String(value ?? "")
    .replace(/[\r\n,]+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeNumber(value, fallback = 0, max = 100000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(parsed, max));
}

function sanitizeDateOnly(rawDate) {
  const value = String(rawDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new AppError(400, "Invalid report date format.", "INVALID_REPORT_DATE");
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, "Invalid report date.", "INVALID_REPORT_DATE");
  }

  return value;
}

function sanitizeIsoDate(rawValue) {
  const parsed = new Date(rawValue ?? new Date().toISOString());
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function sanitizePrayers(rawPrayers) {
  const result = {};

  if (!rawPrayers || typeof rawPrayers !== "object") {
    return result;
  }

  for (const [name, state] of Object.entries(rawPrayers)) {
    if (!state || typeof state !== "object") {
      continue;
    }

    result[sanitizeText(name, 60)] = {
      jamaah: Boolean(state.jamaah),
      fard: Boolean(state.fard),
      sunnah: Boolean(state.sunnah),
      khatm: Boolean(state.khatm),
    };
  }

  return result;
}

function sanitizeWirdList(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList.slice(0, 300).map((entry) => ({
    name: sanitizeText(entry?.name, 100),
    checked: Boolean(entry?.checked),
    points: sanitizeNumber(entry?.points, 0, 100),
  }));
}

function sanitizeZikrs(rawZikrs) {
  if (!Array.isArray(rawZikrs)) {
    return [];
  }

  return rawZikrs.slice(0, 300).map((entry) => ({
    name: sanitizeText(entry?.name, 100),
    count: sanitizeNumber(entry?.count, 0, 100000),
  }));
}

function sanitizeDuas(rawDuas) {
  if (!Array.isArray(rawDuas)) {
    return [];
  }

  return rawDuas
    .slice(0, 300)
    .map((entry) => sanitizeText(entry, 400))
    .filter(Boolean);
}

function normalizeReportPayload(rawPayload) {
  const date = sanitizeDateOnly(rawPayload?.date);
  const savedAt = sanitizeIsoDate(rawPayload?.savedAt);

  return {
    date,
    childName: sanitizeText(rawPayload?.childName, 120),
    prayers: sanitizePrayers(rawPayload?.prayers),
    wirds: {
      daily: sanitizeWirdList(rawPayload?.wirds?.daily),
      weekly: sanitizeWirdList(rawPayload?.wirds?.weekly),
    },
    quran: sanitizeNumber(rawPayload?.quran, 0, 100000),
    zikrs: sanitizeZikrs(rawPayload?.zikrs),
    duas: sanitizeDuas(rawPayload?.duas),
    totalPoints: sanitizeNumber(rawPayload?.totalPoints, 0, 100000),
    savedAt,
  };
}

function parseReportLine(line) {
  try {
    const parsed = JSON.parse(line);
    const username = sanitizeText(parsed?.username, 80).toLowerCase();
    if (!username) {
      return null;
    }

    return {
      username,
      ...normalizeReportPayload(parsed),
    };
  } catch {
    return null;
  }
}

function serializeReport(report) {
  return JSON.stringify(report);
}

async function readAllReports() {
  const lines = await readLines(reportsPath);
  return lines.map(parseReportLine).filter(Boolean);
}

function parseWindow(rawWindow) {
  const windowKey = String(rawWindow ?? "all").trim().toLowerCase();
  if (!ALLOWED_WINDOWS.has(windowKey)) {
    throw new AppError(400, "Invalid report window.", "INVALID_REPORT_WINDOW");
  }

  return windowKey;
}

function getWindowStart(windowKey) {
  if (windowKey === "all") {
    return null;
  }

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const start = new Date(now);
  if (windowKey === "1d") {
    start.setDate(now.getDate() - 0);
  } else if (windowKey === "7d" || windowKey === "1w") {
    start.setDate(now.getDate() - 6);
  } else if (windowKey === "1m") {
    start.setDate(now.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  return start;
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function toReportDate(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvEscape(value) {
  const raw = String(value ?? "");
  const escaped = raw.replace(/"/gu, "\"\"");
  return `"${escaped}"`;
}

export async function initializeReportStore() {
  await ensureFile(reportsPath);
}

export async function upsertUserReport({ username, payload }) {
  const normalized = normalizeReportPayload(payload);
  const owner = sanitizeText(username, 80).toLowerCase();

  if (!owner) {
    throw new AppError(400, "Report owner is required.", "MISSING_REPORT_OWNER");
  }

  const record = {
    username: owner,
    ...normalized,
  };

  await enqueueWrite(async () => {
    const reports = await readAllReports();
    const next = reports.filter((entry) => !(entry.username === owner && entry.date === record.date));
    next.push(record);

    next.sort((a, b) => a.date.localeCompare(b.date) || a.username.localeCompare(b.username));
    await writeLinesAtomic(reportsPath, next.map(serializeReport));
  });

  return record;
}

export async function listReports({ requester, window, usernameFilter }) {
  const windowKey = parseWindow(window);
  const startDate = getWindowStart(windowKey);
  const requesterUsername = sanitizeText(requester?.username, 80).toLowerCase();
  const requesterRole = requester?.role;
  const requestedUsername = usernameFilter ? sanitizeText(usernameFilter, 80).toLowerCase() : null;

  const reports = await readAllReports();

  const visible = reports.filter((entry) => {
    if (isAdminRole(requesterRole)) {
      if (requestedUsername && entry.username !== requestedUsername) {
        return false;
      }
    } else if (entry.username !== requesterUsername) {
      return false;
    }

    if (!startDate) {
      return true;
    }

    const reportDate = toReportDate(entry.date);
    if (!reportDate) {
      return false;
    }

    return reportDate >= startDate;
  });

  visible.sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt));
  return visible;
}

export async function clearReportsForRequester({ requester }) {
  const requesterUsername = sanitizeText(requester?.username, 80).toLowerCase();
  if (!requesterUsername) {
    throw new AppError(400, "Requester username is missing.", "MISSING_REQUESTER");
  }

  await enqueueWrite(async () => {
    const reports = await readAllReports();
    const next = reports.filter((entry) => entry.username !== requesterUsername);
    await writeLinesAtomic(reportsPath, next.map(serializeReport));
  });
}

export async function clearReportsByUsername(username) {
  const targetUsername = sanitizeText(username, 80).toLowerCase();
  if (!targetUsername) {
    throw new AppError(400, "Target username is missing.", "MISSING_TARGET_USERNAME");
  }

  await enqueueWrite(async () => {
    const reports = await readAllReports();
    const next = reports.filter((entry) => entry.username !== targetUsername);
    await writeLinesAtomic(reportsPath, next.map(serializeReport));
  });
}

export function reportsToCsv(reports) {
  const headers = [
    "username",
    "date",
    "childName",
    "totalPoints",
    "quran",
    "zikrsCount",
    "duasCount",
    "dailyWirdChecked",
    "weeklyWirdChecked",
    "savedAt",
  ];

  const rows = reports.map((entry) => {
    const dailyChecked = entry.wirds?.daily?.filter((item) => item.checked).length ?? 0;
    const weeklyChecked = entry.wirds?.weekly?.filter((item) => item.checked).length ?? 0;

    return [
      entry.username,
      entry.date,
      entry.childName,
      entry.totalPoints,
      entry.quran,
      entry.zikrs?.length ?? 0,
      entry.duas?.length ?? 0,
      dailyChecked,
      weeklyChecked,
      entry.savedAt,
    ];
  });

  const lines = [headers, ...rows].map((columns) => columns.map(csvEscape).join(","));
  return `\uFEFF${lines.join("\n")}\n`;
}

export function getReportsPath() {
  return reportsPath;
}
