import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearState,
  createBackup,
  loadState,
  saveState,
  validateBackup,
} from "../src/lib/storage.js";

const STORAGE_KEY = "slate.v1";

const emptyState = {
  goals: [],
  channels: [],
  settings: {},
  videos: [],
  lastRefresh: null,
  history: [],
};

describe("Slate storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("round-trips state through the real versioned localStorage boundary", () => {
    const lastRefresh = new Date("2026-08-24T07:00:00.000Z");
    const state = {
      goals: [{ id: "goal-1", name: "Learn" }],
      channels: ["@channel"],
      settings: { feedCap: 4 },
      videos: [{ id: "video-1", status: "fresh" }],
      lastRefresh,
      history: [{ id: "history-1", watchedAt: lastRefresh.toISOString() }],
    };

    expect(saveState(state)).toEqual({ ok: true });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({
      version: 1,
      lastRefresh: lastRefresh.toISOString(),
    });
    expect(loadState()).toEqual({ status: "ready", state });
  });

  it("keeps only the newest 500 history entries at the storage boundary", () => {
    const history = Array.from({ length: 501 }, (_, index) => ({ id: String(index) }));

    saveState({ ...emptyState, history });

    const loaded = loadState();
    expect(loaded.status).toBe("ready");
    expect(loaded.state.history).toHaveLength(500);
    expect(loaded.state.history[0]).toEqual({ id: "1" });
    expect(loaded.state.history.at(-1)).toEqual({ id: "500" });
  });

  it("distinguishes empty, unsupported, corrupt, and malformed records", () => {
    expect(loadState()).toEqual({ status: "empty", state: null });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 0, goals: [] }));
    expect(loadState()).toEqual({ status: "invalid", state: null, code: "unsupported-version" });

    localStorage.setItem(STORAGE_KEY, "{not-json");
    expect(loadState()).toEqual({ status: "invalid", state: null, code: "invalid-json" });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, goals: "not-an-array" }));
    expect(loadState()).toEqual({ status: "invalid", state: null, code: "invalid-schema" });
  });

  it("normalizes missing optional collections during a valid-state read", () => {
    const lastRefresh = "2026-08-24T07:00:00.000Z";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, goals: [{ id: "goal-1" }], lastRefresh })
    );

    expect(loadState()).toEqual({
      status: "ready",
      state: {
        goals: [{ id: "goal-1" }],
        channels: null,
        settings: null,
        videos: null,
        lastRefresh: new Date(lastRefresh),
        history: [],
      },
    });
  });

  it("returns recoverable results for storage read, write, and clear failures", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(loadState()).toEqual({ status: "unavailable", state: null, code: "read-failed" });

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(saveState(emptyState)).toEqual({ ok: false, code: "write-failed" });

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(clearState()).toEqual({ ok: false, code: "clear-failed" });
  });

  it("creates and validates an allow-listed backup without credential-shaped fields", () => {
    const state = {
      ...emptyState,
      goals: [
        {
          id: "goal-1",
          name: "Learn",
          description: "Useful notes",
          apiKey: "should-not-export",
        },
      ],
      apiKey: "should-not-export",
    };
    const backup = createBackup(state, new Date("2026-08-31T12:00:00.000Z"));

    expect(backup).toEqual({
      format: "slate-backup",
      version: 1,
      exportedAt: "2026-08-31T12:00:00.000Z",
      state: {
        version: 1,
        goals: [{ id: "goal-1", name: "Learn", description: "Useful notes" }],
        channels: [],
        settings: {},
        videos: [],
        lastRefresh: null,
        history: [],
      },
    });
    expect(validateBackup(backup)).toEqual({ ok: true, state: backup.state });
  });

  it("rejects backup envelopes and nested state with unsupported fields or types", () => {
    expect(validateBackup({ format: "other", version: 1 })).toEqual({
      ok: false,
      code: "invalid-backup",
    });
    expect(
      validateBackup({
        format: "slate-backup",
        version: 1,
        exportedAt: "2026-08-31T12:00:00.000Z",
        state: { version: 1, goals: "not-an-array" },
      })
    ).toEqual({ ok: false, code: "invalid-schema" });
  });
});
