const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_MAX_ENTRIES = 1_000;

export function getHeader(req, name) {
  const headers = req?.headers || {};
  if (typeof headers.get === "function") return headers.get(name) || "";
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

export function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function getClientKey(req) {
  const forwarded = getHeader(req, "x-vercel-forwarded-for");
  return forwarded.split(",")[0].trim() || "unknown";
}

export function createRateLimiter({
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) {
  // Defense-in-depth only. Vercel WAF is the authoritative production limit.
  const entries = new Map();

  function cleanup(timestamp) {
    for (const [key, entry] of entries) {
      if (timestamp - entry.startedAt >= windowMs) entries.delete(key);
    }
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  return {
    check(key) {
      const timestamp = now();
      cleanup(timestamp);
      let entry = entries.get(key);
      if (!entry) {
        while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
        entry = { startedAt: timestamp, count: 0 };
        entries.set(key, entry);
      }

      if (timestamp - entry.startedAt >= windowMs) {
        entry.startedAt = timestamp;
        entry.count = 0;
      }

      if (entry.count >= limit) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((entry.startedAt + windowMs - timestamp) / 1_000)),
        };
      }

      entry.count += 1;
      return { allowed: true, retryAfter: 0 };
    },
    size: () => entries.size,
    reset: () => entries.clear(),
  };
}

function originMatchesHost(origin, req) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  const protocol = getHeader(req, "x-forwarded-proto") || req?.protocol || "https";
  return Boolean(host) && parsed.origin === `${protocol}://${host}`;
}

export function isAllowedOrigin(req, allowList = "") {
  const origin = getHeader(req, "origin");
  if (!origin) return true;
  if (originMatchesHost(origin, req)) return true;
  return allowList
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => item === origin);
}
