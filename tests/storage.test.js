import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearState, loadState, saveState } from "../src/lib/storage.js";

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

    saveState(state);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({
      version: 1,
      lastRefresh: lastRefresh.toISOString(),
    });
    expect(loadState()).toEqual(state);
  });

  it("keeps only the newest 500 history entries at the storage boundary", () => {
    const history = Array.from({ length: 501 }, (_, index) => ({ id: String(index) }));

    saveState({ ...emptyState, history });

    const loaded = loadState();
    expect(loaded.history).toHaveLength(500);
    expect(loaded.history[0]).toEqual({ id: "1" });
    expect(loaded.history.at(-1)).toEqual({ id: "500" });
  });

  it("returns null for an older schema version or corrupt JSON so callers can recover", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 0, goals: [] }));
    expect(loadState()).toBeNull();

    localStorage.setItem(STORAGE_KEY, "{not-json");
    expect(loadState()).toBeNull();
  });

  it("normalizes missing optional collections during a valid-state read", () => {
    const lastRefresh = "2026-08-24T07:00:00.000Z";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, goals: [{ id: "goal-1" }], lastRefresh })
    );

    expect(loadState()).toEqual({
      goals: [{ id: "goal-1" }],
      channels: null,
      settings: null,
      videos: null,
      lastRefresh: new Date(lastRefresh),
      history: [],
    });
  });

  it("treats storage read, write, and clear failures as recoverable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(loadState()).toBeNull();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => saveState(emptyState)).not.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => clearState()).not.toThrow();
  });
});
