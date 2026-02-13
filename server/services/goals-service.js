import path from "node:path";
import { config } from "../config.js";
import { FILE_NAMES } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const goalsPath = path.join(config.dataDir, FILE_NAMES.WORSHIP_GOALS);

const DEFAULT_GOALS = Object.freeze({
  dailyGoalPoints: 40,
  weeklyGoalPoints: 250,
});

function nowIso() {
  return new Date().toISOString();
}

function sanitizeNumber(value, fallback = 0, { min = 0, max = 100000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

function sanitizeText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function normalizeGoals(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return {
    dailyGoalPoints: sanitizeNumber(raw.dailyGoalPoints, DEFAULT_GOALS.dailyGoalPoints, { min: 0, max: 100000 }),
    weeklyGoalPoints: sanitizeNumber(raw.weeklyGoalPoints, DEFAULT_GOALS.weeklyGoalPoints, { min: 0, max: 100000 }),
    updatedAt: sanitizeText(raw.updatedAt, 40) || nowIso(),
    updatedBy: sanitizeText(raw.updatedBy, 80) || "system",
  };
}

async function readGoalsUnsafe() {
  const lines = await readLines(goalsPath);
  const parsed = lines.map(parseJsonLine).map(normalizeGoals).filter(Boolean);
  return parsed.at(-1) ?? null;
}

async function writeGoalsUnsafe(goals) {
  await writeLinesAtomic(goalsPath, [JSON.stringify(goals)]);
}

export async function initializeGoalsStore() {
  await ensureFile(goalsPath);

  await enqueueWrite(async () => {
    const existing = await readGoalsUnsafe();
    if (existing) {
      return;
    }

    await writeGoalsUnsafe({
      ...DEFAULT_GOALS,
      updatedAt: nowIso(),
      updatedBy: "system",
    });
  });
}

export async function getGlobalGoals() {
  const existing = await readGoalsUnsafe();
  return (
    existing ?? {
      ...DEFAULT_GOALS,
      updatedAt: nowIso(),
      updatedBy: "system",
    }
  );
}

export async function updateGlobalGoals({ dailyGoalPoints, weeklyGoalPoints, updatedBy }) {
  const daily = sanitizeNumber(dailyGoalPoints, NaN, { min: 0, max: 100000 });
  const weekly = sanitizeNumber(weeklyGoalPoints, NaN, { min: 0, max: 100000 });

  if (!Number.isFinite(daily) || !Number.isFinite(weekly)) {
    throw new AppError(400, "Daily and weekly goals must be numbers.", "INVALID_GOALS");
  }

  const actor = sanitizeText(updatedBy, 80);
  if (!actor) {
    throw new AppError(400, "UpdatedBy is required.", "MISSING_REQUESTER");
  }

  const record = {
    dailyGoalPoints: daily,
    weeklyGoalPoints: weekly,
    updatedAt: nowIso(),
    updatedBy: actor,
  };

  await enqueueWrite(async () => {
    await ensureFile(goalsPath);
    await writeGoalsUnsafe(record);
  });

  return record;
}

