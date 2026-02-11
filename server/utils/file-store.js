import fs from "node:fs/promises";
import path from "node:path";

let writeQueue = Promise.resolve();

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureFile(filePath) {
  await ensureDir(path.dirname(filePath));

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf8");
  }
}

export function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export async function readLines(filePath) {
  await ensureFile(filePath);
  const raw = await fs.readFile(filePath, "utf8");

  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function writeLinesAtomic(filePath, lines) {
  await ensureDir(path.dirname(filePath));

  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const payload = lines.length > 0 ? `${lines.join("\n")}\n` : "";

  await fs.writeFile(tmpPath, payload, "utf8");
  await fs.rename(tmpPath, filePath);
}

export async function appendLine(filePath, line) {
  await enqueueWrite(async () => {
    await ensureFile(filePath);
    await fs.appendFile(filePath, `${line}\n`, "utf8");
  });
}
