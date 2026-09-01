export const MAX_BODY_CHARS = 32_000;
const MAX_GOALS = 8;
const MAX_CHANNELS = 20;
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_KEYWORDS_LENGTH = 1_000;
const MAX_CHANNEL_LENGTH = 200;

export class RequestValidationError extends Error {
  constructor(message, code = "invalid-request") {
    super(message);
    this.name = "RequestValidationError";
    this.code = code;
  }
}

function invalid(message) {
  throw new RequestValidationError(message);
}

function boundedString(value, label, maxLength, { required = true } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") invalid(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) invalid(`${label} is required.`);
  if (trimmed.length > maxLength) invalid(`${label} is too long.`);
  return trimmed;
}

function boundedNumber(value, label, min, max, { integer = false, fallback } = {}) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(`${label} is invalid.`);
  if (integer && !Number.isInteger(value)) invalid(`${label} must be a whole number.`);
  if (value < min || value > max) invalid(`${label} is out of range.`);
  return value;
}

function normalizeGoal(goal, index) {
  if (!goal || typeof goal !== "object" || Array.isArray(goal)) {
    invalid(`goal ${index + 1} is invalid.`);
  }

  return {
    id: boundedString(goal.id, `goal ${index + 1} id`, MAX_ID_LENGTH),
    name: boundedString(goal.name, `goal ${index + 1} name`, MAX_NAME_LENGTH),
    description: boundedString(
      goal.description,
      `goal ${index + 1} description`,
      MAX_DESCRIPTION_LENGTH
    ),
    ...(goal.keywords !== undefined
      ? { keywords: boundedString(goal.keywords, `goal ${index + 1} keywords`, MAX_KEYWORDS_LENGTH) }
      : {}),
    ...(goal.endDate !== undefined
      ? { endDate: boundedString(goal.endDate, `goal ${index + 1} end date`, 40) }
      : {}),
    weeklyMinutes: boundedNumber(goal.weeklyMinutes, `goal ${index + 1} weekly minutes`, 1, 10_080, {
      integer: true,
    }),
  };
}

function normalizeSettings(settings) {
  if (settings === undefined) settings = {};
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    invalid("settings must be an object.");
  }

  if (settings.blockShorts !== undefined && typeof settings.blockShorts !== "boolean") {
    invalid("blockShorts is invalid.");
  }

  return {
    minLengthMin: boundedNumber(settings.minLengthMin, "minLengthMin", 0, 180, {
      integer: true,
      fallback: 8,
    }),
    blockShorts: settings.blockShorts ?? true,
    feedCap: boundedNumber(settings.feedCap, "feedCap", 1, 30, {
      integer: true,
      fallback: 12,
    }),
    lookbackDays: boundedNumber(settings.lookbackDays, "lookbackDays", 1, 365, {
      integer: true,
      fallback: 90,
    }),
  };
}

export function normalizeRequestBody(rawBody) {
  let serialized;
  try {
    serialized = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody ?? {});
  } catch {
    invalid("Request body is invalid.");
  }
  if (serialized.length > MAX_BODY_CHARS) invalid("Request body is too large.");

  let body = rawBody;
  if (typeof rawBody === "string") {
    try {
      body = JSON.parse(rawBody);
    } catch {
      invalid("Request body is not valid JSON.");
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("Request body must be an object.");
  }
  if (!Array.isArray(body.goals) || body.goals.length < 1 || body.goals.length > MAX_GOALS) {
    invalid(`goals must contain 1-${MAX_GOALS} items.`);
  }
  if (!Array.isArray(body.channels) || body.channels.length > MAX_CHANNELS) {
    invalid(`channels must contain at most ${MAX_CHANNELS} items.`);
  }

  return {
    goals: body.goals.map(normalizeGoal),
    channels: body.channels.map((channel, index) =>
      boundedString(channel, `channel ${index + 1}`, MAX_CHANNEL_LENGTH)
    ),
    settings: normalizeSettings(body.settings),
  };
}
