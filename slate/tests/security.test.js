import test from "node:test";
import assert from "node:assert/strict";
import { postgresPoolOptions } from "../lib/database-config.js";
import { normalizeSlateRequest, RequestValidationError } from "../lib/request-validation.js";

test("hosted Postgres connections verify TLS certificates", () => {
  const options = postgresPoolOptions("postgresql://user:pass@db.example.com:5432/slate?sslmode=no-verify");
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(options.connectionString.includes("sslmode"), false);
});

test("loopback development databases can run without TLS", () => {
  assert.equal(postgresPoolOptions("postgresql://localhost/slate").ssl, false);
  assert.equal(postgresPoolOptions("postgresql://[::1]/slate").ssl, false);
});

test("generation input is bounded and normalized", () => {
  const result = normalizeSlateRequest({
    goals: [{ id: "goal-1", name: " Security ", description: " Practical depth ", weeklyMinutes: 9999 }],
    channels: ["@example"],
    settings: { feedCap: 999, lookbackDays: -2 },
  });
  assert.equal(result.goals[0].name, "Security");
  assert.equal(result.goals[0].weeklyMinutes, 1200);
  assert.equal(result.settings.feedCap, 24);
  assert.equal(result.settings.lookbackDays, 1);
});

test("generation input rejects missing goals and oversized text", () => {
  assert.throws(() => normalizeSlateRequest({ goals: [] }), RequestValidationError);
  assert.throws(
    () => normalizeSlateRequest({ goals: [{ id: "g", name: "x", description: "a".repeat(1201) }] }),
    /too long/,
  );
});
