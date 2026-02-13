import fs from "node:fs/promises";
import path from "node:path";

function timestampForDir(date = new Date()) {
  // Safe for Windows and Linux (no ":"), stable and sortable.
  return date.toISOString().replace(/[:.]/g, "-");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listImmediateFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

async function getLatestBackupStat(backupsDir) {
  try {
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!entry.name.startsWith("backup-")) {
        continue;
      }
      const fullPath = path.join(backupsDir, entry.name);
      const stat = await fs.stat(fullPath);
      candidates.push({ name: entry.name, fullPath, stat });
    }
    candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

async function pruneOldBackups({ backupsDir, retentionDays, logger }) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return 0;
  }

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  let pruned = 0;
  let entries = [];
  try {
    entries = await fs.readdir(backupsDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("backup-")) {
      continue;
    }

    const fullPath = path.join(backupsDir, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs >= cutoffMs) {
        continue;
      }

      await fs.rm(fullPath, { recursive: true, force: true });
      pruned += 1;
    } catch (error) {
      logger?.warn?.(`[backup] Failed pruning ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return pruned;
}

export async function runBackupOnce({ dataDir, retentionDays = 14, logger = console } = {}) {
  if (!dataDir) {
    throw new Error("dataDir is required to run backups.");
  }

  const backupsDir = path.join(dataDir, "backups");
  await ensureDir(backupsDir);

  const backupName = `backup-${timestampForDir(new Date())}`;
  const backupDir = path.join(backupsDir, backupName);
  await ensureDir(backupDir);

  const files = await listImmediateFiles(dataDir);
  let copied = 0;
  for (const filename of files) {
    // Only back up plain files from the root of DATA_DIR.
    const src = path.join(dataDir, filename);
    const dst = path.join(backupDir, filename);
    try {
      await fs.copyFile(src, dst);
      copied += 1;
    } catch (error) {
      logger?.warn?.(`[backup] Failed copying ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    await fs.writeFile(
      path.join(backupDir, "manifest.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sourceDir: dataDir,
          files,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // Non-fatal.
  }

  const pruned = await pruneOldBackups({ backupsDir, retentionDays, logger });

  return { backupDir, copied, pruned };
}

export function startBackupScheduler({
  enabled,
  dataDir,
  intervalMs,
  retentionDays,
  logger = console,
} = {}) {
  if (!enabled) {
    return { stop: () => undefined };
  }
  if (!dataDir || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Invalid backup scheduler configuration.");
  }

  const backupsDir = path.join(dataDir, "backups");
  let running = false;

  const safeRun = async ({ force = false, reason = "scheduled" } = {}) => {
    if (running) {
      return;
    }
    running = true;

    try {
      await ensureDir(backupsDir);

      if (!force) {
        const latest = await getLatestBackupStat(backupsDir);
        if (latest && Date.now() - latest.stat.mtimeMs < intervalMs) {
          // Avoid creating a new backup on frequent restarts/deploys.
          logger?.log?.("[backup] Skipping backup (recent backup exists).");
          return;
        }
      }

      const result = await runBackupOnce({ dataDir, retentionDays, logger });
      logger?.log?.(
        `[backup] ${reason}: copied ${result.copied} file(s) to ${path.basename(result.backupDir)} (pruned ${result.pruned}).`,
      );
    } catch (error) {
      logger?.warn?.(`[backup] Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };

  // Try once on startup, but skip if a recent backup already exists.
  void safeRun({ force: false, reason: "startup" });

  const timerId = setInterval(() => {
    void safeRun({ force: true, reason: "interval" });
  }, intervalMs);

  return {
    stop: () => clearInterval(timerId),
  };
}

