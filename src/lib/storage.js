/**
 * Local persistence for Slate.
 *
 * The storage boundary returns discriminated results so an unavailable or
 * corrupt record cannot be mistaken for an ordinary blank first run. Demo
 * mode is gated by App before this module is called and remains stateless.
 */

const KEY = "slate.v1";
const VERSION = 1;

const GOAL_FIELDS = ["id", "name", "description", "keywords", "endDate", "weeklyMinutes"];
const SETTINGS_FIELDS = ["minLengthMin", "blockShorts", "feedCap", "refreshTimes", "lookbackDays"];
const VIDEO_FIELDS = [
  "id",
  "title",
  "channel",
  "description",
  "thumb",
  "published",
  "duration",
  "viewCount",
  "likeCount",
  "commentCount",
  "url",
  "goalId",
  "relevanceScore",
  "score",
  "why",
  "cache",
  "status",
  "demoLabel",
];
const HISTORY_FIELDS = ["id", "title", "goalId", "duration", "watchedAt"];

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pickFields(value, fields) {
  if (!isPlainObject(value)) return {};
  const picked = {};
  for (const field of fields) {
    if (hasOwn(value, field) && value[field] !== undefined) picked[field] = value[field];
  }
  return picked;
}

function serializeDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : value;
  }
  return null;
}

function sanitizeState(state = {}) {
  return {
    version: VERSION,
    goals: Array.isArray(state.goals) ? state.goals.map((goal) => pickFields(goal, GOAL_FIELDS)) : [],
    channels: Array.isArray(state.channels)
      ? state.channels.filter((channel) => typeof channel === "string")
      : [],
    settings: pickFields(state.settings, SETTINGS_FIELDS),
    videos: Array.isArray(state.videos)
      ? state.videos.map((video) => pickFields(video, VIDEO_FIELDS))
      : [],
    lastRefresh: serializeDate(state.lastRefresh),
    history: Array.isArray(state.history)
      ? state.history.map((entry) => pickFields(entry, HISTORY_FIELDS)).slice(-500)
      : [],
  };
}

function validateStoredRecord(data) {
  if (!isPlainObject(data)) return { ok: false, code: "invalid-schema" };
  if (data.version !== VERSION) return { ok: false, code: "unsupported-version" };
  if (!Array.isArray(data.goals)) return { ok: false, code: "invalid-schema" };

  for (const field of ["channels", "videos", "history"]) {
    if (hasOwn(data, field) && data[field] !== null && !Array.isArray(data[field])) {
      return { ok: false, code: "invalid-schema" };
    }
  }
  if (hasOwn(data, "settings") && data.settings !== null && !isPlainObject(data.settings)) {
    return { ok: false, code: "invalid-schema" };
  }
  if (data.lastRefresh !== undefined && data.lastRefresh !== null) {
    if (typeof data.lastRefresh !== "string" || Number.isNaN(new Date(data.lastRefresh).getTime())) {
      return { ok: false, code: "invalid-schema" };
    }
  }

  return {
    ok: true,
    state: {
      goals: data.goals,
      channels: data.channels ?? null,
      settings: data.settings ?? null,
      videos: data.videos ?? null,
      lastRefresh: data.lastRefresh ? new Date(data.lastRefresh) : null,
      history: data.history ?? [],
    },
  };
}

export function loadState() {
  let raw;
  try {
    raw = globalThis.localStorage.getItem(KEY);
  } catch {
    return { status: "unavailable", state: null, code: "read-failed" };
  }

  if (raw === null || raw === "") return { status: "empty", state: null };

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: "invalid", state: null, code: "invalid-json" };
  }

  const result = validateStoredRecord(data);
  return result.ok
    ? { status: "ready", state: result.state }
    : { status: "invalid", state: null, code: result.code };
}

export function saveState(state) {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(sanitizeState(state)));
    return { ok: true };
  } catch {
    return { ok: false, code: "write-failed" };
  }
}

export function clearState() {
  try {
    globalThis.localStorage.removeItem(KEY);
    return { ok: true };
  } catch {
    return { ok: false, code: "clear-failed" };
  }
}

export function createBackup(state, exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  return {
    format: "slate-backup",
    version: VERSION,
    exportedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    state: sanitizeState(state),
  };
}

export function validateBackup(backup) {
  if (!isPlainObject(backup) || backup.format !== "slate-backup" || backup.version !== VERSION) {
    return { ok: false, code: "invalid-backup" };
  }
  if (typeof backup.exportedAt !== "string" || Number.isNaN(new Date(backup.exportedAt).getTime())) {
    return { ok: false, code: "invalid-backup" };
  }

  const result = validateStoredRecord(backup.state);
  if (!result.ok) return { ok: false, code: result.code };
  return { ok: true, state: sanitizeState(result.state) };
}
