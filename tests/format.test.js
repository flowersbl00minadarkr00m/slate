import { afterEach, describe, expect, it, vi } from "vitest";
import { nextUnlock, parseISODuration } from "../src/lib/format.js";

describe("parseISODuration", () => {
  it("converts ISO-8601 hour, minute, and second components to seconds", () => {
    expect(parseISODuration("PT1H2M3S")).toBe(3723);
  });

  it("handles partial durations and rejects malformed input", () => {
    expect(parseISODuration("PT45M")).toBe(2700);
    expect(parseISODuration("not-a-duration")).toBe(0);
    expect(parseISODuration(undefined)).toBe(0);
  });
});

describe("nextUnlock", () => {
  afterEach(() => vi.useRealTimers());

  it("allows the first edition when there is no previous refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 12, 0));

    expect(nextUnlock(["07:00", "17:00"], null)).toEqual({ allowed: true });
  });

  it("allows a refresh after a scheduled edition has passed since the last refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 18, 0));

    expect(nextUnlock(["07:00", "17:00"], new Date(2026, 7, 24, 8, 0))).toEqual({
      allowed: true,
    });
  });

  it("returns the next same-day edition while the lock is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 12, 0));

    expect(nextUnlock(["07:00", "17:00"], new Date(2026, 7, 24, 8, 0))).toEqual({
      allowed: false,
      next: new Date(2026, 7, 24, 17, 0),
    });
  });

  it("rolls the next edition to tomorrow after the final daily time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 18, 0));

    expect(nextUnlock(["07:00", "17:00"], new Date(2026, 7, 24, 17, 30))).toEqual({
      allowed: false,
      next: new Date(2026, 7, 25, 7, 0),
    });
  });
});
