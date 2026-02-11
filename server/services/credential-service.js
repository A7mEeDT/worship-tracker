import path from "node:path";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { FILE_NAMES, Roles } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { ensureDir, ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.@-]{3,80}$/u;
const MIN_PASSWORD_LENGTH = 10;

const filePaths = {
  users: path.join(config.dataDir, FILE_NAMES.USERS),
  admins: path.join(config.dataDir, FILE_NAMES.ADMIN_CREDENTIALS),
  primaryAdmins: path.join(config.dataDir, FILE_NAMES.PRIMARY_ADMINS),
  deactivatedUsers: path.join(config.dataDir, FILE_NAMES.DEACTIVATED_USERS),
};

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function validateUsername(rawUsername) {
  const username = normalizeUsername(rawUsername);

  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      400,
      "Username must be 3-80 chars and only use letters, numbers, dot, underscore, @, or hyphen.",
      "INVALID_USERNAME",
    );
  }

  return username;
}

function validatePassword(password) {
  const value = String(password ?? "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, "WEAK_PASSWORD");
  }
}

function parseCredentialLines(lines) {
  const map = new Map();

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      continue;
    }

    const username = normalizeUsername(line.slice(0, separatorIndex));
    const passwordHash = line.slice(separatorIndex + 1).trim();

    if (!username || !passwordHash) {
      continue;
    }

    map.set(username, { username, passwordHash });
  }

  return map;
}

function serializeCredentialMap(map) {
  return [...map.values()]
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((entry) => `${entry.username}:${entry.passwordHash}`);
}

function parseSimpleSet(lines) {
  return new Set(lines.map(normalizeUsername).filter(Boolean));
}

function serializeSimpleSet(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

async function readCredentialMap(filePath) {
  const lines = await readLines(filePath);
  return parseCredentialLines(lines);
}

async function readSimpleSet(filePath) {
  const lines = await readLines(filePath);
  return parseSimpleSet(lines);
}

function resolveRoleForUsername(username, adminMap, primaryAdminSet, userMap) {
  if (primaryAdminSet.has(username) && adminMap.has(username)) {
    return Roles.PRIMARY_ADMIN;
  }

  if (adminMap.has(username)) {
    return Roles.ADMIN;
  }

  if (userMap.has(username)) {
    return Roles.USER;
  }

  return null;
}

async function ensurePrimaryAdmin(adminMap, primaryAdminSet) {
  const configuredPrimary = normalizeUsername(config.primaryAdminUsername);

  // Guarantee at least one primary admin account in a recoverable bootstrap path.
  if (!primaryAdminSet.size) {
    primaryAdminSet.add(configuredPrimary);
  }

  for (const username of [...primaryAdminSet]) {
    if (adminMap.has(username)) {
      continue;
    }

    if (username !== configuredPrimary) {
      primaryAdminSet.delete(username);
      continue;
    }

    const passwordHash = await bcrypt.hash(config.primaryAdminPassword, config.bcryptRounds);
    adminMap.set(username, { username, passwordHash });
  }

  if (!primaryAdminSet.size) {
    primaryAdminSet.add(configuredPrimary);

    if (!adminMap.has(configuredPrimary)) {
      const passwordHash = await bcrypt.hash(config.primaryAdminPassword, config.bcryptRounds);
      adminMap.set(configuredPrimary, { username: configuredPrimary, passwordHash });
    }
  }
}

export async function initializeCredentialStore() {
  await ensureDir(config.dataDir);
  await Promise.all([
    ensureFile(filePaths.users),
    ensureFile(filePaths.admins),
    ensureFile(filePaths.primaryAdmins),
    ensureFile(filePaths.deactivatedUsers),
  ]);

  await enqueueWrite(async () => {
    const adminMap = await readCredentialMap(filePaths.admins);
    const primaryAdminSet = await readSimpleSet(filePaths.primaryAdmins);

    // Keep primary-admin list and admin credential file in sync at startup.
    await ensurePrimaryAdmin(adminMap, primaryAdminSet);

    await Promise.all([
      writeLinesAtomic(filePaths.admins, serializeCredentialMap(adminMap)),
      writeLinesAtomic(filePaths.primaryAdmins, serializeSimpleSet(primaryAdminSet)),
    ]);
  });
}

export async function getUserByUsername(rawUsername) {
  const username = normalizeUsername(rawUsername);

  if (!username) {
    return null;
  }

  const [userMap, adminMap, primaryAdminSet, deactivatedSet] = await Promise.all([
    readCredentialMap(filePaths.users),
    readCredentialMap(filePaths.admins),
    readSimpleSet(filePaths.primaryAdmins),
    readSimpleSet(filePaths.deactivatedUsers),
  ]);

  const role = resolveRoleForUsername(username, adminMap, primaryAdminSet, userMap);
  if (!role) {
    return null;
  }

  const sourceMap = role === Roles.USER ? userMap : adminMap;
  const entry = sourceMap.get(username);

  return {
    username,
    role,
    passwordHash: entry.passwordHash,
    isActive: !deactivatedSet.has(username),
  };
}

export async function authenticateUser(rawUsername, password) {
  const record = await getUserByUsername(rawUsername);
  if (!record || !record.isActive) {
    return null;
  }

  const isMatch = await bcrypt.compare(String(password ?? ""), record.passwordHash);
  if (!isMatch) {
    return null;
  }

  return {
    username: record.username,
    role: record.role,
  };
}

export async function listUsers() {
  const [userMap, adminMap, primaryAdminSet, deactivatedSet] = await Promise.all([
    readCredentialMap(filePaths.users),
    readCredentialMap(filePaths.admins),
    readSimpleSet(filePaths.primaryAdmins),
    readSimpleSet(filePaths.deactivatedUsers),
  ]);

  const users = [];

  for (const username of userMap.keys()) {
    users.push({
      username,
      role: Roles.USER,
      isActive: !deactivatedSet.has(username),
    });
  }

  for (const username of adminMap.keys()) {
    users.push({
      username,
      role: primaryAdminSet.has(username) ? Roles.PRIMARY_ADMIN : Roles.ADMIN,
      isActive: !deactivatedSet.has(username),
    });
  }

  const rolePriority = {
    [Roles.PRIMARY_ADMIN]: 0,
    [Roles.ADMIN]: 1,
    [Roles.USER]: 2,
  };

  return users.sort((a, b) => {
    const roleDelta = rolePriority[a.role] - rolePriority[b.role];
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return a.username.localeCompare(b.username);
  });
}

export async function createUser({ username: rawUsername, password, role = Roles.USER }) {
  const username = validateUsername(rawUsername);
  validatePassword(password);

  if (![Roles.USER, Roles.ADMIN].includes(role)) {
    throw new AppError(400, "Role must be user or admin.", "INVALID_ROLE");
  }

  return enqueueWrite(async () => {
    const [userMap, adminMap, deactivatedSet] = await Promise.all([
      readCredentialMap(filePaths.users),
      readCredentialMap(filePaths.admins),
      readSimpleSet(filePaths.deactivatedUsers),
    ]);

    if (userMap.has(username) || adminMap.has(username)) {
      throw new AppError(409, "Username already exists.", "USER_EXISTS");
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const entry = { username, passwordHash };

    if (role === Roles.ADMIN) {
      adminMap.set(username, entry);
      await writeLinesAtomic(filePaths.admins, serializeCredentialMap(adminMap));
    } else {
      userMap.set(username, entry);
      await writeLinesAtomic(filePaths.users, serializeCredentialMap(userMap));
    }

    deactivatedSet.delete(username);
    await writeLinesAtomic(filePaths.deactivatedUsers, serializeSimpleSet(deactivatedSet));

    return { username, role, isActive: true };
  });
}

export async function updateUser({ username: rawUsername, password, isActive }) {
  const username = validateUsername(rawUsername);
  const hasPasswordUpdate = typeof password === "string" && password.length > 0;

  if (hasPasswordUpdate) {
    validatePassword(password);
  }

  if (typeof isActive !== "boolean" && !hasPasswordUpdate) {
    throw new AppError(400, "No updatable fields provided.", "NO_UPDATES");
  }

  return enqueueWrite(async () => {
    const [userMap, adminMap, primaryAdminSet, deactivatedSet] = await Promise.all([
      readCredentialMap(filePaths.users),
      readCredentialMap(filePaths.admins),
      readSimpleSet(filePaths.primaryAdmins),
      readSimpleSet(filePaths.deactivatedUsers),
    ]);

    const role = resolveRoleForUsername(username, adminMap, primaryAdminSet, userMap);
    if (!role) {
      throw new AppError(404, "User not found.", "USER_NOT_FOUND");
    }

    const targetMap = role === Roles.USER ? userMap : adminMap;
    const current = targetMap.get(username);

    if (hasPasswordUpdate) {
      current.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      targetMap.set(username, current);
      await writeLinesAtomic(
        role === Roles.USER ? filePaths.users : filePaths.admins,
        serializeCredentialMap(targetMap),
      );
    }

    if (typeof isActive === "boolean") {
      if (isActive) {
        deactivatedSet.delete(username);
      } else {
        deactivatedSet.add(username);
      }

      await writeLinesAtomic(filePaths.deactivatedUsers, serializeSimpleSet(deactivatedSet));
    }

    return {
      username,
      role,
      isActive: !deactivatedSet.has(username),
    };
  });
}

export async function deleteUser(rawUsername) {
  const username = validateUsername(rawUsername);

  return enqueueWrite(async () => {
    const [userMap, adminMap, primaryAdminSet, deactivatedSet] = await Promise.all([
      readCredentialMap(filePaths.users),
      readCredentialMap(filePaths.admins),
      readSimpleSet(filePaths.primaryAdmins),
      readSimpleSet(filePaths.deactivatedUsers),
    ]);

    if (primaryAdminSet.has(username)) {
      throw new AppError(400, "Primary admin cannot be deleted.", "PRIMARY_ADMIN_PROTECTED");
    }

    let deletedRole = null;

    if (userMap.delete(username)) {
      deletedRole = Roles.USER;
      await writeLinesAtomic(filePaths.users, serializeCredentialMap(userMap));
    }

    if (adminMap.delete(username)) {
      deletedRole = Roles.ADMIN;
      await writeLinesAtomic(filePaths.admins, serializeCredentialMap(adminMap));
    }

    if (!deletedRole) {
      throw new AppError(404, "User not found.", "USER_NOT_FOUND");
    }

    deactivatedSet.delete(username);
    await writeLinesAtomic(filePaths.deactivatedUsers, serializeSimpleSet(deactivatedSet));

    return {
      username,
      role: deletedRole,
    };
  });
}

export async function promoteUserToAdmin(rawUsername) {
  const username = validateUsername(rawUsername);

  return enqueueWrite(async () => {
    const [userMap, adminMap] = await Promise.all([
      readCredentialMap(filePaths.users),
      readCredentialMap(filePaths.admins),
    ]);

    if (adminMap.has(username)) {
      throw new AppError(409, "User is already an admin.", "ALREADY_ADMIN");
    }

    const entry = userMap.get(username);
    if (!entry) {
      throw new AppError(404, "User not found in regular users.", "USER_NOT_FOUND");
    }

    userMap.delete(username);
    adminMap.set(username, entry);

    await Promise.all([
      writeLinesAtomic(filePaths.users, serializeCredentialMap(userMap)),
      writeLinesAtomic(filePaths.admins, serializeCredentialMap(adminMap)),
    ]);

    return {
      username,
      role: Roles.ADMIN,
      isActive: true,
    };
  });
}

export async function listAdminUsernames() {
  const [adminMap, deactivatedSet] = await Promise.all([
    readCredentialMap(filePaths.admins),
    readSimpleSet(filePaths.deactivatedUsers),
  ]);

  return [...adminMap.keys()].filter((username) => !deactivatedSet.has(username));
}
