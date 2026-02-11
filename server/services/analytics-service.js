import { ALLOWED_DASHBOARD_WINDOWS } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { readLines } from "../utils/file-store.js";
import { getActivityLogPath } from "./activity-service.js";

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseActivityLine(line) {
  const parts = line.split(",").map((segment) => segment.trim());
  if (parts.length < 4) {
    return null;
  }

  const [timestamp, username, action, ipAddress] = parts;
  const date = new Date(timestamp.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    timestamp,
    username,
    action,
    ipAddress,
    date,
  };
}

export function parseDashboardWindow(rawWindow) {
  const days = Number(rawWindow ?? 30);
  if (!ALLOWED_DASHBOARD_WINDOWS.includes(days)) {
    throw new AppError(400, "Invalid window. Allowed values: 7, 30, 90.", "INVALID_WINDOW");
  }

  return days;
}

function buildWindowRange(days) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export async function getActivityTimeline(days) {
  const range = buildWindowRange(days);
  const lines = await readLines(getActivityLogPath());
  const events = lines.map(parseActivityLine).filter(Boolean);

  const dayBuckets = new Map();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(range.start);
    date.setDate(range.start.getDate() + index);
    dayBuckets.set(formatDateKey(date), 0);
  }

  for (const event of events) {
    if (event.date < range.start || event.date > range.end) {
      continue;
    }

    const key = formatDateKey(event.date);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }

  return [...dayBuckets.entries()].map(([date, actions]) => ({ date, actions }));
}

export async function getPerUserDistribution(days) {
  const range = buildWindowRange(days);
  const lines = await readLines(getActivityLogPath());
  const events = lines.map(parseActivityLine).filter(Boolean);
  const userBuckets = new Map();

  for (const event of events) {
    if (event.date < range.start || event.date > range.end) {
      continue;
    }

    userBuckets.set(event.username, (userBuckets.get(event.username) ?? 0) + 1);
  }

  return [...userBuckets.entries()]
    .map(([username, actions]) => ({ username, actions }))
    .sort((a, b) => b.actions - a.actions || a.username.localeCompare(b.username));
}
