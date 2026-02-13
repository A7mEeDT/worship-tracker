import crypto from "node:crypto";
import path from "node:path";
import { config } from "../config.js";
import { FILE_NAMES } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { appendLine, ensureFile, enqueueWrite, readLines, writeLinesAtomic } from "../utils/file-store.js";

const groupsPath = path.join(config.dataDir, FILE_NAMES.QUESTION_GROUPS);
const sessionsPath = path.join(config.dataDir, FILE_NAMES.QUESTION_SESSIONS);
const submissionsPath = path.join(config.dataDir, FILE_NAMES.QUESTION_SUBMISSIONS);

const GROUP_STATUSES = new Set(["draft", "open", "locked", "closed"]);
const QUESTION_TYPES = new Set(["text", "multiple_choice"]);

function sanitizeText(value, maxLength = 400) {
  return String(value ?? "")
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeNumber(value, fallback = 0, min = 0, max = 100000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

function sanitizeIsoDate(value) {
  const parsed = new Date(value ?? new Date().toISOString());
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeComparableAnswer(value) {
  return sanitizeText(value, 200).toLowerCase();
}

function csvEscape(value) {
  const raw = String(value ?? "");
  // Prevent basic Excel formula injection.
  const safe = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/gu, "\"\"")}"`;
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function parseGroupLine(line) {
  const parsed = parseJsonLine(line);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const id = sanitizeText(parsed.id, 80);
  if (!id) {
    return null;
  }

  const status = String(parsed.status ?? "draft");
  if (!GROUP_STATUSES.has(status)) {
    return null;
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return {
    id,
    title: sanitizeText(parsed.title, 120),
    status,
    durationSeconds: sanitizeNumber(parsed.durationSeconds, 0, 1, 86400),
    openedAt: parsed.openedAt ? sanitizeIsoDate(parsed.openedAt) : null,
    closesAt: parsed.closesAt ? sanitizeIsoDate(parsed.closesAt) : null,
    createdAt: sanitizeIsoDate(parsed.createdAt),
    updatedAt: sanitizeIsoDate(parsed.updatedAt),
    questions: questions
      .slice(0, 200)
      .map((entry, index) => normalizeQuestion(entry, index))
      .filter(Boolean),
  };
}

function normalizeQuestion(raw, index) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const type = String(raw.type ?? "");
  if (!QUESTION_TYPES.has(type)) {
    return null;
  }

  const id = sanitizeText(raw.id ?? `q${index + 1}`, 40) || `q${index + 1}`;
  const prompt = sanitizeText(raw.prompt, 500);
  const points = sanitizeNumber(raw.points, 1, 0, 10000);

  if (type === "multiple_choice") {
    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    const options = rawOptions
      .slice(0, 12)
      .map((opt, optIndex) => ({
        id: sanitizeText(opt?.id ?? `o${optIndex + 1}`, 40) || `o${optIndex + 1}`,
        label: sanitizeText(opt?.label, 200),
      }))
      .filter((opt) => opt.id && opt.label);

    const correctAnswer = sanitizeText(raw.correctAnswer, 80);
    const optionIds = new Set(options.map((opt) => opt.id));
    const normalizedCorrect = optionIds.has(correctAnswer) ? correctAnswer : "";

    return {
      id,
      type,
      prompt,
      points,
      options,
      correctAnswer: normalizedCorrect,
    };
  }

  return {
    id,
    type,
    prompt,
    points,
    options: [],
    correctAnswer: sanitizeText(raw.correctAnswer, 200),
  };
}

function groupIsExpired(group, now = new Date()) {
  if (!group || group.status !== "open" || !group.closesAt) {
    return false;
  }

  const closesAt = new Date(group.closesAt);
  if (Number.isNaN(closesAt.getTime())) {
    return false;
  }

  return now.getTime() > closesAt.getTime();
}

async function readAllGroups() {
  const lines = await readLines(groupsPath);
  return lines.map(parseGroupLine).filter(Boolean);
}

async function writeAllGroups(groups) {
  await writeLinesAtomic(groupsPath, groups.map((g) => JSON.stringify(g)));
}

async function readAllSessions() {
  const lines = await readLines(sessionsPath);
  const sessions = [];

  for (const line of lines) {
    const parsed = parseJsonLine(line);
    if (!parsed || typeof parsed !== "object") {
      continue;
    }
    const groupId = sanitizeText(parsed.groupId, 80);
    const username = sanitizeText(parsed.username, 80).toLowerCase();
    const startedAt = parsed.startedAt ? sanitizeIsoDate(parsed.startedAt) : null;
    if (!groupId || !username || !startedAt) {
      continue;
    }
    sessions.push({ groupId, username, startedAt });
  }

  return sessions;
}

async function readAllSubmissions() {
  const lines = await readLines(submissionsPath);
  const submissions = [];

  for (const line of lines) {
    const parsed = parseJsonLine(line);
    if (!parsed || typeof parsed !== "object") {
      continue;
    }

    const id = sanitizeText(parsed.id, 100);
    const groupId = sanitizeText(parsed.groupId, 80);
    const username = sanitizeText(parsed.username, 80).toLowerCase();
    if (!id || !groupId || !username) {
      continue;
    }

    const answers = Array.isArray(parsed.answers) ? parsed.answers : [];
    const details = Array.isArray(parsed.details) ? parsed.details : [];

    submissions.push({
      id,
      groupId,
      username,
      startedAt: parsed.startedAt ? sanitizeIsoDate(parsed.startedAt) : null,
      submittedAt: parsed.submittedAt ? sanitizeIsoDate(parsed.submittedAt) : null,
      durationMs: sanitizeNumber(parsed.durationMs, 0, 0, 86400 * 1000),
      score: sanitizeNumber(parsed.score, 0, 0, 1000000),
      maxScore: sanitizeNumber(parsed.maxScore, 0, 0, 1000000),
      answers: answers
        .slice(0, 300)
        .map((entry) => ({
          questionId: sanitizeText(entry?.questionId, 80),
          answer: sanitizeText(entry?.answer, 600),
        }))
        .filter((entry) => entry.questionId),
      details: details
        .slice(0, 300)
        .map((entry) => ({
          questionId: sanitizeText(entry?.questionId, 80),
          correct: Boolean(entry?.correct),
          pointsEarned: sanitizeNumber(entry?.pointsEarned, 0, 0, 100000),
          pointsPossible: sanitizeNumber(entry?.pointsPossible, 0, 0, 100000),
        }))
        .filter((entry) => entry.questionId),
    });
  }

  return submissions;
}

function validateGroupInput({ title, durationSeconds, questions }) {
  const cleanedTitle = sanitizeText(title, 120);
  const duration = sanitizeNumber(durationSeconds, 0, 10, 86400);

  if (!duration) {
    throw new AppError(400, "Duration is required.", "INVALID_DURATION");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AppError(400, "At least one question is required.", "MISSING_QUESTIONS");
  }

  const normalizedQuestions = questions
    .slice(0, 200)
    .map((entry, index) => normalizeQuestion(entry, index))
    .filter(Boolean);

  if (!normalizedQuestions.length) {
    throw new AppError(400, "No valid questions provided.", "INVALID_QUESTIONS");
  }

  for (const q of normalizedQuestions) {
    if (!q.prompt) {
      throw new AppError(400, "Question prompt is required.", "INVALID_QUESTION_PROMPT");
    }
    if (!Number.isFinite(q.points) || q.points < 0) {
      throw new AppError(400, "Question points must be a non-negative integer.", "INVALID_QUESTION_POINTS");
    }
    if (q.type === "multiple_choice") {
      if (!q.options.length) {
        throw new AppError(400, "Multiple choice questions need options.", "MISSING_OPTIONS");
      }
      if (!q.correctAnswer) {
        throw new AppError(400, "Correct option is required for multiple choice questions.", "MISSING_CORRECT");
      }
    } else if (!q.correctAnswer) {
      throw new AppError(400, "Correct answer is required for text questions.", "MISSING_CORRECT");
    }
  }

  return {
    title: cleanedTitle,
    durationSeconds: duration,
    questions: normalizedQuestions,
  };
}

function toUserGroupView(group, now = new Date()) {
  const openedAt = group.openedAt ? sanitizeIsoDate(group.openedAt) : null;
  const closesAt = group.closesAt ? sanitizeIsoDate(group.closesAt) : null;

  const expired = groupIsExpired(group, now);
  const isOpen = group.status === "open" && closesAt && !expired;
  const remainingSeconds = isOpen ? Math.max(0, Math.ceil((new Date(closesAt).getTime() - now.getTime()) / 1000)) : 0;

  return {
    id: group.id,
    title: group.title,
    status: expired ? "closed" : group.status,
    durationSeconds: group.durationSeconds,
    openedAt,
    closesAt,
    remainingSeconds,
    questions: isOpen
      ? group.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: q.type === "multiple_choice" ? q.options : [],
      }))
      : [],
  };
}

function computeScore({ group, answersById }) {
  let score = 0;
  let maxScore = 0;

  const details = group.questions.map((q) => {
    maxScore += q.points;

    const rawAnswer = answersById[q.id];
    const answer = sanitizeText(rawAnswer, 600);

    let correct = false;
    if (q.type === "multiple_choice") {
      correct = answer === q.correctAnswer;
    } else {
      correct = normalizeComparableAnswer(answer) === normalizeComparableAnswer(q.correctAnswer);
    }

    const pointsEarned = correct ? q.points : 0;
    score += pointsEarned;

    return {
      questionId: q.id,
      correct,
      pointsEarned,
      pointsPossible: q.points,
    };
  });

  return { score, maxScore, details };
}

export async function initializeQuestionStore() {
  await ensureFile(groupsPath);
  await ensureFile(sessionsPath);
  await ensureFile(submissionsPath);
}

export async function listGroupsForAdmin() {
  const groups = await readAllGroups();
  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return groups;
}

export async function listGroupsForUser() {
  const groups = await readAllGroups();
  const now = new Date();

  // Opportunistically close expired groups.
  const changed = groups.some((g) => groupIsExpired(g, now));
  if (changed) {
    await enqueueWrite(async () => {
      const current = await readAllGroups();
      const next = current.map((g) => (groupIsExpired(g, now) ? { ...g, status: "closed", updatedAt: new Date().toISOString() } : g));
      await writeAllGroups(next);
    });
  }

  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return groups.map((g) => toUserGroupView(g, now));
}

export async function getActiveGroupForUser({ username }) {
  const now = new Date();

  const groups = await readAllGroups();
  const openGroup = groups.find((g) => g.status === "open" && !groupIsExpired(g, now)) ?? null;
  const hasExpiredOpen = groups.some((g) => groupIsExpired(g, now));

  // Opportunistically close expired open groups.
  if (hasExpiredOpen) {
    await enqueueWrite(async () => {
      const current = await readAllGroups();
      const next = current.map((g) =>
        groupIsExpired(g, now) ? { ...g, status: "closed", updatedAt: new Date().toISOString() } : g,
      );
      await writeAllGroups(next);
    });
  }

  const candidate =
    openGroup ??
    groups
      .filter((g) => g.status !== "draft" && g.openedAt)
      .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)))
      .at(0) ??
    null;

  if (!candidate) {
    return { group: null };
  }

  if (candidate.status === "open" && !groupIsExpired(candidate, now)) {
    await ensureUserSession({ groupId: candidate.id, username, now });
  }

  return { group: toUserGroupView(candidate, now) };
}

async function ensureUserSession({ groupId, username, now = new Date() }) {
  const cleanedUsername = sanitizeText(username, 80).toLowerCase();
  if (!groupId || !cleanedUsername) {
    return null;
  }

  const sessions = await readAllSessions();
  const existing = sessions.find((s) => s.groupId === groupId && s.username === cleanedUsername);
  if (existing) {
    return existing.startedAt;
  }

  const startedAt = now.toISOString();
  await appendLine(sessionsPath, JSON.stringify({ groupId, username: cleanedUsername, startedAt }));
  return startedAt;
}

export async function createGroup({ title, durationSeconds, questions }) {
  const normalized = validateGroupInput({ title, durationSeconds, questions });
  const now = new Date().toISOString();

  const group = {
    id: `qg_${crypto.randomUUID()}`,
    title: normalized.title,
    status: "draft",
    durationSeconds: normalized.durationSeconds,
    openedAt: null,
    closesAt: null,
    createdAt: now,
    updatedAt: now,
    questions: normalized.questions,
  };

  await enqueueWrite(async () => {
    const groups = await readAllGroups();
    groups.push(group);
    await writeAllGroups(groups);
  });

  return group;
}

export async function updateGroup({ groupId, title, durationSeconds, questions }) {
  const normalized = validateGroupInput({ title, durationSeconds, questions });
  const targetId = sanitizeText(groupId, 80);

  if (!targetId) {
    throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
  }

  let updated = null;
  await enqueueWrite(async () => {
    const groups = await readAllGroups();
    const index = groups.findIndex((g) => g.id === targetId);
    if (index < 0) {
      throw new AppError(404, "Question group not found.", "GROUP_NOT_FOUND");
    }

    const current = groups[index];
    if (current.status === "open") {
      throw new AppError(409, "Cannot edit a group while it is open.", "GROUP_OPEN");
    }

    updated = {
      ...current,
      title: normalized.title,
      durationSeconds: normalized.durationSeconds,
      questions: normalized.questions,
      updatedAt: new Date().toISOString(),
    };
    groups[index] = updated;
    await writeAllGroups(groups);
  });

  return updated;
}

export async function openGroup({ groupId }) {
  const targetId = sanitizeText(groupId, 80);
  if (!targetId) {
    throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
  }

  const now = new Date();
  const openedAt = now.toISOString();

  let opened = null;
  await enqueueWrite(async () => {
    const groups = await readAllGroups();
    const index = groups.findIndex((g) => g.id === targetId);
    if (index < 0) {
      throw new AppError(404, "Question group not found.", "GROUP_NOT_FOUND");
    }

    // Only allow one open group at a time. Lock any currently open group.
    const next = groups.map((g) => {
      if (g.status === "open" && g.id !== targetId) {
        return { ...g, status: "locked", updatedAt: new Date().toISOString() };
      }
      return g;
    });

    const current = next[index];
    if (current.status === "open") {
      opened = current;
      await writeAllGroups(next);
      return;
    }

    const closesAt = new Date(now.getTime() + current.durationSeconds * 1000).toISOString();
    opened = {
      ...current,
      status: "open",
      openedAt,
      closesAt,
      updatedAt: openedAt,
    };

    next[index] = opened;
    await writeAllGroups(next);
  });

  return opened;
}

export async function lockGroup({ groupId }) {
  const targetId = sanitizeText(groupId, 80);
  if (!targetId) {
    throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
  }

  let locked = null;
  await enqueueWrite(async () => {
    const groups = await readAllGroups();
    const index = groups.findIndex((g) => g.id === targetId);
    if (index < 0) {
      throw new AppError(404, "Question group not found.", "GROUP_NOT_FOUND");
    }

    const current = groups[index];
    locked = {
      ...current,
      status: "locked",
      updatedAt: new Date().toISOString(),
    };
    groups[index] = locked;
    await writeAllGroups(groups);
  });

  return locked;
}

export async function submitAnswers({ groupId, username, answersById }) {
  const targetId = sanitizeText(groupId, 80);
  const cleanedUsername = sanitizeText(username, 80).toLowerCase();
  if (!targetId || !cleanedUsername) {
    throw new AppError(400, "Invalid group or username.", "INVALID_REQUEST");
  }

  const now = new Date();
  const groups = await readAllGroups();
  const group = groups.find((g) => g.id === targetId);
  if (!group) {
    throw new AppError(404, "Question group not found.", "GROUP_NOT_FOUND");
  }

  if (group.status !== "open" || groupIsExpired(group, now)) {
    throw new AppError(403, "This question group is not accepting submissions.", "GROUP_CLOSED");
  }

  const submissions = await readAllSubmissions();
  const already = submissions.find((s) => s.groupId === targetId && s.username === cleanedUsername);
  if (already) {
    throw new AppError(409, "You already submitted this group.", "ALREADY_SUBMITTED");
  }

  const startedAt = await ensureUserSession({ groupId: targetId, username: cleanedUsername, now });
  const submittedAt = now.toISOString();
  const durationMs = Math.max(0, now.getTime() - new Date(startedAt).getTime());

  const { score, maxScore, details } = computeScore({ group, answersById: answersById ?? {} });

  const answers = group.questions.map((q) => ({
    questionId: q.id,
    answer: sanitizeText(answersById?.[q.id], 600),
  }));

  const record = {
    id: `qs_${crypto.randomUUID()}`,
    groupId: targetId,
    username: cleanedUsername,
    startedAt,
    submittedAt,
    durationMs,
    score,
    maxScore,
    answers,
    details,
  };

  await appendLine(submissionsPath, JSON.stringify(record));
  return record;
}

export async function listSubmissionsForAdmin({ groupId }) {
  const targetId = sanitizeText(groupId, 80);
  if (!targetId) {
    throw new AppError(400, "Group ID is required.", "MISSING_GROUP_ID");
  }

  const submissions = await readAllSubmissions();
  const filtered = submissions.filter((s) => s.groupId === targetId);
  filtered.sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
  return filtered;
}

export async function exportSubmissionsCsv({ groupId }) {
  const targetId = sanitizeText(groupId, 80);
  const groups = await readAllGroups();
  const group = groups.find((g) => g.id === targetId);
  if (!group) {
    throw new AppError(404, "Question group not found.", "GROUP_NOT_FOUND");
  }

  const submissions = await listSubmissionsForAdmin({ groupId: targetId });

  const header = [
    "groupId",
    "groupTitle",
    "username",
    "score",
    "maxScore",
    "timeSpentSeconds",
    "startedAt",
    "submittedAt",
    "answersJson",
    "detailsJson",
  ].map(csvEscape).join(",");

  const rows = submissions.map((s) => {
    const answersMap = {};
    for (const entry of s.answers) {
      answersMap[entry.questionId] = entry.answer;
    }

    return [
      targetId,
      group.title,
      s.username,
      s.score,
      s.maxScore,
      Math.round((s.durationMs ?? 0) / 1000),
      s.startedAt ?? "",
      s.submittedAt ?? "",
      JSON.stringify(answersMap),
      JSON.stringify(s.details ?? []),
    ].map(csvEscape).join(",");
  });

  return `${header}\n${rows.join("\n")}\n`;
}

export function getStorePaths() {
  return {
    groupsPath,
    sessionsPath,
    submissionsPath,
  };
}
