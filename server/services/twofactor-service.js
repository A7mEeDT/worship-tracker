import crypto from "node:crypto";
import path from "node:path";
import { generateSecret, generateURI, verify } from "otplib";
import { config } from "../config.js";
import { FILE_NAMES } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const twoFactorPath = path.join(config.dataDir, FILE_NAMES.ADMIN_2FA);

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function deriveEncryptionKey() {
  const raw = String(config.totpEncryptionSecret ?? "");
  if (!raw) {
    throw new Error("Missing totpEncryptionSecret configuration.");
  }

  // Derive a fixed-length key without making assumptions about user input format.
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

function encryptSecret(plainSecret) {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainSecret), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

function decryptSecret(payload) {
  const raw = String(payload ?? "");
  if (!raw) {
    return "";
  }

  if (!raw.startsWith("v1:")) {
    // Backwards-compatible: allow plaintext secrets from older versions.
    return raw;
  }

  const [, ivB64, dataB64, tagB64] = raw.split(":");
  if (!ivB64 || !dataB64 || !tagB64) {
    return "";
  }

  try {
    const key = deriveEncryptionKey();
    const iv = Buffer.from(ivB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");
    const tag = Buffer.from(tagB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

function sanitizeRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const username = normalizeUsername(raw.username);
  if (!username) {
    return null;
  }

  const secret = typeof raw.secret === "string" ? raw.secret : "";
  const enabled = Boolean(raw.enabled);

  return {
    username,
    secret,
    enabled,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    enabledAt: typeof raw.enabledAt === "string" ? raw.enabledAt : null,
  };
}

async function readRecordMap() {
  const lines = await readLines(twoFactorPath);
  const map = new Map();

  for (const line of lines) {
    const parsed = sanitizeRecord(parseJsonLine(line));
    if (!parsed) {
      continue;
    }

    map.set(parsed.username, parsed);
  }

  return map;
}

async function writeRecordMap(map) {
  const lines = [...map.values()]
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((entry) => JSON.stringify(entry));

  await writeLinesAtomic(twoFactorPath, lines);
}

function validateOtp(rawOtp) {
  const otp = String(rawOtp ?? "").trim();
  if (!/^\d{6}$/u.test(otp)) {
    throw new AppError(400, "OTP code must be a 6-digit number.", "INVALID_OTP");
  }
  return otp;
}

export async function initializeTwoFactorStore() {
  await ensureFile(twoFactorPath);
}

export async function getTwoFactorStatus(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    return { status: "disabled", enabledAt: null };
  }

  const map = await readRecordMap();
  const record = map.get(username);

  if (!record) {
    return { status: "disabled", enabledAt: null };
  }

  if (record.enabled) {
    return { status: "enabled", enabledAt: record.enabledAt ?? null };
  }

  return { status: "pending", enabledAt: null };
}

export async function hasTwoFactorEnabled(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    return false;
  }

  const map = await readRecordMap();
  return Boolean(map.get(username)?.enabled);
}

export async function beginTwoFactorSetup(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    throw new AppError(400, "Username is required.", "MISSING_USERNAME");
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: config.totpIssuer,
    label: username,
    secret,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });
  const encrypted = encryptSecret(secret);

  await enqueueWrite(async () => {
    const map = await readRecordMap();
    map.set(username, {
      username,
      secret: encrypted,
      enabled: false,
      createdAt: nowIso(),
      enabledAt: null,
    });
    await writeRecordMap(map);
  });

  return { secret, otpauthUrl, issuer: config.totpIssuer };
}

export async function enableTwoFactor(rawUsername, rawOtp) {
  const username = normalizeUsername(rawUsername);
  const otp = validateOtp(rawOtp);

  return enqueueWrite(async () => {
    const map = await readRecordMap();
    const record = map.get(username);

    if (!record || record.enabled) {
      throw new AppError(400, "No pending 2FA setup exists.", "NO_PENDING_2FA");
    }

    const secret = decryptSecret(record.secret);
    if (!secret) {
      throw new AppError(500, "Failed to read 2FA secret.", "TOTP_SECRET_INVALID");
    }

    const verifyResult = await verify({
      secret,
      token: otp,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    if (!verifyResult?.valid) {
      throw new AppError(401, "Invalid OTP code.", "TOTP_INVALID");
    }

    record.enabled = true;
    record.enabledAt = nowIso();
    map.set(username, record);
    await writeRecordMap(map);

    return { status: "enabled", enabledAt: record.enabledAt };
  });
}

export async function verifyTwoFactorForLogin(rawUsername, rawOtp) {
  const username = normalizeUsername(rawUsername);
  const otp = validateOtp(rawOtp);

  const map = await readRecordMap();
  const record = map.get(username);

  if (!record || !record.enabled) {
    throw new AppError(400, "Two-factor authentication is not enabled.", "TOTP_NOT_ENABLED");
  }

  const secret = decryptSecret(record.secret);
  if (!secret) {
    throw new AppError(500, "Failed to read 2FA secret.", "TOTP_SECRET_INVALID");
  }

  const verifyResult = await verify({
    secret,
    token: otp,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
  });
  if (!verifyResult?.valid) {
    throw new AppError(401, "Invalid OTP code.", "TOTP_INVALID");
  }

  return true;
}

export async function disableTwoFactor(rawUsername, rawOtp) {
  const username = normalizeUsername(rawUsername);
  const otp = validateOtp(rawOtp);

  return enqueueWrite(async () => {
    const map = await readRecordMap();
    const record = map.get(username);

    if (!record || !record.enabled) {
      throw new AppError(400, "Two-factor authentication is not enabled.", "TOTP_NOT_ENABLED");
    }

    const secret = decryptSecret(record.secret);
    if (!secret) {
      throw new AppError(500, "Failed to read 2FA secret.", "TOTP_SECRET_INVALID");
    }

    const verifyResult = await verify({
      secret,
      token: otp,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    if (!verifyResult?.valid) {
      throw new AppError(401, "Invalid OTP code.", "TOTP_INVALID");
    }

    map.delete(username);
    await writeRecordMap(map);

    return { status: "disabled" };
  });
}

export async function cancelTwoFactorSetup(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    throw new AppError(400, "Username is required.", "MISSING_USERNAME");
  }

  return enqueueWrite(async () => {
    const map = await readRecordMap();
    const record = map.get(username);
    if (record && !record.enabled) {
      map.delete(username);
      await writeRecordMap(map);
    }

    return { status: "disabled" };
  });
}

export async function resetTwoFactor(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    throw new AppError(400, "Username is required.", "MISSING_USERNAME");
  }

  return enqueueWrite(async () => {
    const map = await readRecordMap();
    map.delete(username);
    await writeRecordMap(map);
    return { status: "disabled" };
  });
}
