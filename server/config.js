import path from "node:path";

const DEFAULT_JWT_SECRET = "replace-this-secret-in-production";

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.API_PORT ?? process.env.PORT, 3001),
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "server", "data"),
  jwtSecret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  sessionMaxAgeMs: parseNumber(process.env.SESSION_MAX_AGE_MS, 8 * 60 * 60 * 1000),
  bcryptRounds: parseNumber(process.env.BCRYPT_ROUNDS, 12),
  primaryAdminUsername: (process.env.PRIMARY_ADMIN_USERNAME ?? "primary-admin").toLowerCase(),
  primaryAdminPassword: process.env.PRIMARY_ADMIN_PASSWORD ?? "ChangeMe!2026",
  totpIssuer: process.env.TOTP_ISSUER ?? "Worship Tracker",
  totpEncryptionSecret: process.env.TOTP_ENCRYPTION_SECRET ?? (process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET),
  admin2faEnforce: parseBoolean(process.env.ADMIN_2FA_ENFORCE, false),
  backupEnabled: parseBoolean(process.env.BACKUP_ENABLED, (process.env.NODE_ENV ?? "development") === "production"),
  backupIntervalMs: parseNumber(
    process.env.BACKUP_INTERVAL_MS,
    parseNumber(process.env.BACKUP_INTERVAL_HOURS, 24) * 60 * 60 * 1000,
  ),
  backupRetentionDays: parseNumber(process.env.BACKUP_RETENTION_DAYS, 14),
};

if (config.nodeEnv === "production" && config.jwtSecret === DEFAULT_JWT_SECRET) {
  console.warn("JWT_SECRET is using the default value. Set a strong secret in production.");
}
