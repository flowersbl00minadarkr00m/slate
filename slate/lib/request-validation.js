const MAX_BODY_CHARS = 32_000;
const MAX_GOALS = 8;
const MAX_CHANNELS = 20;

export class RequestValidationError extends Error {}

function text(value, label, maxLength, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new RequestValidationError(label + " must be text.");
  const normalized = value.trim();
  if (required && !normalized) throw new RequestValidationError(label + " is required.");
  if (normalized.length > maxLength) throw new RequestValidationError(label + " is too long.");
  return normalized;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSlateRequest(rawBody) {
  let body = rawBody;
  if (typeof body === "string") {
    if (body.length > MAX_BODY_CHARS) throw new RequestValidationError("Request body is too large.");
    try {
      body = JSON.parse(body);
    } catch {
      throw new RequestValidationError("Request body must be valid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestValidationError("Request body must be a JSON object.");
  }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    throw new RequestValidationError("Request body is too large.");
  }
  if (!Array.isArray(body.goals) || body.goals.length === 0 || body.goals.length > MAX_GOALS) {
    throw new RequestValidationError("Send between 1 and 8 active goals.");
  }

  const goals = body.goals.map((goal, index) => {
    if (!goal || typeof goal !== "object" || Array.isArray(goal)) {
      throw new RequestValidationError("Goal " + (index + 1) + " must be an object.");
    }
    return {
      id: text(goal.id, "Goal ID", 80, true),
      name: text(goal.name, "Goal name", 160, true),
      description: text(goal.description, "Goal description", 1_200, true),
      keywords: text(goal.keywords, "Goal keywords", 300),
      endDate: text(goal.endDate, "Goal end date", 20),
      weeklyMinutes: boundedNumber(goal.weeklyMinutes, 60, 15, 1_200),
    };
  });

  if (body.channels != null && !Array.isArray(body.channels)) {
    throw new RequestValidationError("Channels must be a list.");
  }
  if ((body.channels || []).length > MAX_CHANNELS) {
    throw new RequestValidationError("Send no more than 20 channels.");
  }
  const channels = (body.channels || []).map((channel, index) =>
    text(channel, "Channel " + (index + 1), 120, true)
  );

  const sourceSettings = body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
    ? body.settings
    : {};
  const settings = {
    minLengthMin: boundedNumber(sourceSettings.minLengthMin, 8, 1, 180),
    blockShorts: sourceSettings.blockShorts !== false,
    feedCap: Math.round(boundedNumber(sourceSettings.feedCap, 12, 1, 24)),
    lookbackDays: Math.round(boundedNumber(sourceSettings.lookbackDays, 90, 1, 365)),
  };

  return { goals, channels, settings };
}
