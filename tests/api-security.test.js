import { afterEach, describe, expect, it, vi } from "vitest";
import { createBuildSlateHandler } from "../api/build-slate.js";
import { createHealthHandler } from "../api/health.js";
import {
  createRateLimiter,
  getClientKey,
  isAllowedOrigin,
} from "../api/lib/request-policy.js";
import {
  MAX_BODY_CHARS,
  RequestValidationError,
  normalizeRequestBody,
} from "../api/lib/request-validation.js";
import { getDatabaseConfig } from "../api/lib/database-config.js";

const validGoal = {
  id: "goal-1",
  name: "Learn systems",
  description: "Study feedback loops and delays.",
  keywords: "systems thinking",
  weeklyMinutes: 60,
};

const validBody = {
  goals: [validGoal],
  channels: ["@systems-channel"],
  settings: {
    minLengthMin: 8,
    blockShorts: true,
    feedCap: 12,
    lookbackDays: 90,
  },
};

const enabledEnv = {
  SLATE_API_ENABLED: "1",
  OPENAI_API_KEY: "configured",
  YOUTUBE_API_KEY: "configured",
};

function makeRequest({ method = "POST", headers = {}, body = validBody } = {}) {
  return {
    method,
    body,
    headers: { host: "slate.example.test", "content-type": "application/json", ...headers },
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

async function invoke(options = {}, request = {}) {
  const response = makeResponse();
  const handler = createBuildSlateHandler({
    env: enabledEnv,
    builder: vi.fn().mockResolvedValue({ videos: [], quotaUsed: 0 }),
    ...options,
  });
  await handler(makeRequest(request), response);
  return { response, builder: options.builder || handler.builder };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request normalization", () => {
  it("accepts the current App payload and strips unknown fields", () => {
    const normalized = normalizeRequestBody({
      ...validBody,
      secret: "must not cross the boundary",
      goals: [{ ...validGoal, unknown: "drop me" }],
    });

    expect(normalized).toEqual(validBody);
    expect(normalized.secret).toBeUndefined();
    expect(normalized.goals[0].unknown).toBeUndefined();
  });

  it("rejects malformed, oversized, and out-of-range input", () => {
    expect(() => normalizeRequestBody("not-json")).toThrow(RequestValidationError);
    expect(() => normalizeRequestBody("x".repeat(MAX_BODY_CHARS + 1))).toThrow(
      RequestValidationError
    );
    expect(() =>
      normalizeRequestBody({
        ...validBody,
        goals: Array.from({ length: 9 }, () => validGoal),
      })
    ).toThrow(/goals/i);
    expect(() =>
      normalizeRequestBody({
        ...validBody,
        channels: Array.from({ length: 21 }, () => "channel"),
      })
    ).toThrow(/channels/i);
  });
});

describe("request policy", () => {
  it("derives a conservative client key from the trusted Vercel header", () => {
    expect(getClientKey(makeRequest({ headers: { "x-vercel-forwarded-for": "203.0.113.9, proxy" } }))).toBe(
      "203.0.113.9"
    );
    expect(getClientKey(makeRequest())).toBe("unknown");
  });

  it("allows missing origin but checks present origins against host or allow-list", () => {
    expect(isAllowedOrigin(makeRequest(), "")).toBe(true);
    expect(
      isAllowedOrigin(
        makeRequest({ headers: { origin: "https://slate.example.test", "x-forwarded-proto": "https" } }),
        ""
      )
    ).toBe(true);
    expect(
      isAllowedOrigin(
        makeRequest({ headers: { origin: "https://other.example.test" } }),
        "https://other.example.test"
      )
    ).toBe(true);
    expect(
      isAllowedOrigin(makeRequest({ headers: { origin: "https://other.example.test" } }), "")
    ).toBe(false);
  });

  it("cleans stale entries and never grows beyond its configured bound", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 100, maxEntries: 2, now: () => now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.size()).toBe(2);
    expect(limiter.check("c").allowed).toBe(true);
    expect(limiter.size()).toBe(2);
    now = 101;
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.size()).toBe(1);
  });
});

describe("build-slate route", () => {
  it.each([
    ["method", { method: "GET" }, 405, "method-not-allowed"],
    ["media type", { headers: { "content-type": "text/plain" } }, 415, "unsupported-media-type"],
    ["origin", { headers: { origin: "https://other.example.test" } }, 403, "origin-not-allowed"],
  ])("rejects %s before the builder seam", async (_label, request, status, code) => {
    const builder = vi.fn();
    const { response } = await invoke({ builder }, request);
    expect(response.statusCode).toBe(status);
    expect(response.body.code).toBe(code);
    expect(builder).not.toHaveBeenCalled();
  });

  it("rejects disabled, rate-limited, invalid, and misconfigured requests before paid work", async () => {
    const builder = vi.fn().mockResolvedValue({ videos: [] });
    const disabled = makeResponse();
    await createBuildSlateHandler({ env: { ...enabledEnv, SLATE_API_ENABLED: "0" }, builder })(
      makeRequest(),
      disabled
    );
    expect(disabled.statusCode).toBe(503);
    expect(builder).not.toHaveBeenCalled();

    const limited = makeResponse();
    const limiter = createRateLimiter({ limit: 1, windowMs: 600_000 });
    const limitedHandler = createBuildSlateHandler({ env: enabledEnv, builder, limiter });
    await limitedHandler(makeRequest(), limited);
    await limitedHandler(makeRequest(), limited);
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();

    const invalid = makeResponse();
    await createBuildSlateHandler({ env: enabledEnv, builder })(
      makeRequest({ body: JSON.stringify({ ...validBody, goals: [] }) }),
      invalid
    );
    expect(invalid.statusCode).toBe(400);

    const oversized = makeResponse();
    await createBuildSlateHandler({ env: enabledEnv, builder })(
      makeRequest({ body: JSON.stringify({ ...validBody, padding: "x".repeat(MAX_BODY_CHARS) }) }),
      oversized
    );
    expect(oversized.statusCode).toBe(400);

    const misconfigured = makeResponse();
    await createBuildSlateHandler({
      env: { SLATE_API_ENABLED: "1", OPENAI_API_KEY: "configured" },
      builder,
    })(makeRequest(), misconfigured);
    expect(misconfigured.statusCode).toBe(503);
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it("passes a valid bounded payload to the stubbed builder and preserves its response", async () => {
    const builder = vi.fn().mockResolvedValue({ videos: [{ id: "video-1" }], quotaUsed: 1 });
    const { response } = await invoke({ builder }, { headers: { "content-type": "application/json" } });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ videos: [{ id: "video-1" }], quotaUsed: 1 });
    expect(builder).toHaveBeenCalledWith(validBody);
  });

  it("returns a bounded request id and safe code for unexpected failures", async () => {
    const leakedDetail = "untrusted failure detail";
    const builder = vi.fn().mockRejectedValue(new Error(leakedDetail));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { response } = await invoke({ builder });

    expect(response.statusCode).toBe(500);
    expect(response.body).toMatchObject({ error: "Slate generation failed.", code: "internal-error" });
    expect(response.body.requestId).toMatch(/^req_[a-f0-9-]+$/);
    expect(JSON.stringify(response.body)).not.toContain(leakedDetail);
    expect(logged.mock.calls.flat().join(" ")).not.toContain(leakedDetail);
  });
});

describe("health route", () => {
  it("reports bounded readiness without making external calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not call"));
    const response = makeResponse();
    await createHealthHandler({
      env: {
        SLATE_API_ENABLED: "1",
        OPENAI_API_KEY: "configured",
        YOUTUBE_API_KEY: "configured",
        POSTGRES_URL: "configured",
      },
    })(makeRequest({ method: "GET" }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: "ready",
      generationEnabled: true,
      providersConfigured: true,
      cacheConfigured: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the same safe shape with 503 when configuration is incomplete", async () => {
    const response = makeResponse();
    await createHealthHandler({ env: { SLATE_API_ENABLED: "0" } })(
      makeRequest({ method: "GET" }),
      response
    );

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      status: "not-ready",
      generationEnabled: false,
      providersConfigured: false,
      cacheConfigured: false,
    });
  });

  it("rejects non-GET requests without inspecting provider state", async () => {
    const response = makeResponse();
    await createHealthHandler({ env: {} })(makeRequest({ method: "POST" }), response);

    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe("GET");
    expect(response.body.code).toBe("method-not-allowed");
  });
});

describe("database configuration", () => {
  it("requires certificate verification for hosted Postgres even when URL flags disagree", () => {
    const config = getDatabaseConfig(`${"postgres"}ql:${"//db.example.test/slate?sslmode=disable"}`);

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
  });

  it("allows non-TLS only for loopback and rejects unsupported URLs", () => {
    expect(getDatabaseConfig(`${"postgres"}ql:${"//localhost/slate"}`).ssl).toBe(false);
    expect(() => getDatabaseConfig("https://db.example.test/slate")).toThrow(/postgres/i);
  });
});
