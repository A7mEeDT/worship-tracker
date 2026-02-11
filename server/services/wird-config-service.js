import path from "node:path";
import { config } from "../config.js";
import { FILE_NAMES } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const wirdConfigPath = path.join(config.dataDir, FILE_NAMES.WIRD_CONFIG);

const DEFAULT_WIRDS = [
  { name: "أذكار الصباح", type: "daily", val: 2 },
  { name: "صلاة الضحى", type: "daily", val: 1 },
  { name: "الصلاة على النبي ﷺ", type: "daily", val: 2 },
  { name: "أذكار المساء", type: "daily", val: 2 },
  { name: "قيام الليل", type: "daily", val: 2 },
  { name: "صلاة الوتر", type: "daily", val: 2 },
  { name: "أذكار النوم", type: "daily", val: 2 },
  { name: "سورة الكهف", type: "weekly", val: 2 },
  { name: "صدقة", type: "weekly", val: 2 },
  { name: "صيام تطوع", type: "weekly", val: 5 },
];

const VALID_TYPES = new Set(["daily", "weekly"]);
const MAX_ITEMS = 200;

function normalizeName(rawValue) {
  return String(rawValue ?? "")
    .replace(/[\r\n|]+/gu, " ")
    .trim();
}

function validateWirdEntry(rawEntry, index) {
  const name = normalizeName(rawEntry?.name);
  const type = String(rawEntry?.type ?? "").trim();
  const val = Number(rawEntry?.val);

  if (!name || name.length > 100) {
    throw new AppError(400, `Invalid wird name at index ${index}.`, "INVALID_WIRD_NAME");
  }

  if (!VALID_TYPES.has(type)) {
    throw new AppError(400, `Invalid wird type at index ${index}.`, "INVALID_WIRD_TYPE");
  }

  if (!Number.isFinite(val) || val <= 0 || val > 100) {
    throw new AppError(400, `Invalid wird points at index ${index}.`, "INVALID_WIRD_POINTS");
  }

  return {
    name,
    type,
    val: Math.trunc(val),
  };
}

function parseWirdLine(line) {
  const [nameRaw, typeRaw, valRaw] = line.split("|");
  if (!nameRaw || !typeRaw || !valRaw) {
    return null;
  }

  const val = Number(valRaw);
  if (!Number.isFinite(val)) {
    return null;
  }

  try {
    return validateWirdEntry(
      {
        name: nameRaw,
        type: typeRaw,
        val,
      },
      0,
    );
  } catch {
    return null;
  }
}

function serializeWirds(wirds) {
  return wirds.map((entry) => `${entry.name}|${entry.type}|${entry.val}`);
}

async function readWirdsFromDisk() {
  const lines = await readLines(wirdConfigPath);
  const parsed = lines.map(parseWirdLine).filter(Boolean);

  if (!parsed.length) {
    return [...DEFAULT_WIRDS];
  }

  return parsed;
}

export async function initializeWirdConfigStore() {
  await ensureFile(wirdConfigPath);

  await enqueueWrite(async () => {
    const lines = await readLines(wirdConfigPath);

    if (lines.length > 0) {
      return;
    }

    await writeLinesAtomic(wirdConfigPath, serializeWirds(DEFAULT_WIRDS));
  });
}

export async function getWirdConfig() {
  return readWirdsFromDisk();
}

export async function updateWirdConfig(rawWirds) {
  if (!Array.isArray(rawWirds)) {
    throw new AppError(400, "Wirds payload must be an array.", "INVALID_WIRD_PAYLOAD");
  }

  if (rawWirds.length === 0 || rawWirds.length > MAX_ITEMS) {
    throw new AppError(400, "Wirds count is out of allowed range.", "INVALID_WIRD_COUNT");
  }

  const wirds = rawWirds.map((entry, index) => validateWirdEntry(entry, index));

  await enqueueWrite(async () => {
    await writeLinesAtomic(wirdConfigPath, serializeWirds(wirds));
  });

  return wirds;
}

export function getWirdConfigPath() {
  return wirdConfigPath;
}
