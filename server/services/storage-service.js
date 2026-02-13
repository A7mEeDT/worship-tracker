import fs from "node:fs/promises";
import path from "node:path";

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function listImmediateFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function listImmediateDirectories(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function sumDirectoryFilesBytes(dirPath) {
  const files = await listImmediateFiles(dirPath);
  let total = 0;
  for (const name of files) {
    const stat = await safeStat(path.join(dirPath, name));
    if (stat?.isFile()) {
      total += stat.size;
    }
  }
  return total;
}

export async function getStorageOverview({ dataDir }) {
  const rootFiles = await listImmediateFiles(dataDir);
  const rootDirectories = await listImmediateDirectories(dataDir);

  const files = [];
  let totalBytes = 0;

  for (const name of rootFiles) {
    const fullPath = path.join(dataDir, name);
    const stat = await safeStat(fullPath);
    if (!stat?.isFile()) {
      continue;
    }

    totalBytes += stat.size;
    files.push({
      name,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const backupsDir = path.join(dataDir, "backups");
  const backupFolders = (await listImmediateDirectories(backupsDir)).filter((name) => name.startsWith("backup-"));

  const backups = [];
  let backupsTotalBytes = 0;

  for (const folder of backupFolders) {
    const backupPath = path.join(backupsDir, folder);
    const stat = await safeStat(backupPath);
    if (!stat?.isDirectory()) {
      continue;
    }

    const bytes = await sumDirectoryFilesBytes(backupPath);
    backupsTotalBytes += bytes;

    backups.push({
      name: folder,
      sizeBytes: bytes,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  backups.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    dataDir,
    totalBytes,
    files,
    directories: rootDirectories.sort((a, b) => a.localeCompare(b)),
    backups: {
      dirName: "backups",
      count: backups.length,
      totalBytes: backupsTotalBytes,
      lastBackupAt: backups[0]?.updatedAt ?? null,
      items: backups.slice(0, 200),
    },
  };
}

