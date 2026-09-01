import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isShortcutSuppressed, nextCardIndex } from "../src/lib/keyboard.js";
import { FeedView } from "../src/views/FeedView.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const goal = { id: "goal-1", name: "Learn", weeklyMinutes: 60 };
const videos = [
  { id: "video-1", title: "First video", channel: "Test", duration: 600, goalId: goal.id, score: 90, why: "first", status: "fresh" },
  { id: "video-2", title: "Second video", channel: "Test", duration: 900, goalId: goal.id, score: 80, why: "second", status: "fresh" },
];

let root;

function keydown(target, key, options = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

async function renderFeed(overrides = {}) {
  const props = {
    videos,
    activeGoals: [goal],
    settings: { refreshTimes: ["07:00", "17:00"] },
    gate: { allowed: true },
    loading: false,
    loadStep: "",
    error: "",
    refresh: vi.fn(),
    playing: null,
    setPlaying: vi.fn(),
    mark: vi.fn(),
    quotaUsed: 0,
    cacheStats: null,
    ...overrides,
  };
  await act(async () => root.render(<FeedView {...props} />));
  return props;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root"));
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("shortcut guards", () => {
  it("suppresses controls, editables, modifiers, and composition", () => {
    const button = document.createElement("button");
    const buttonChild = document.createElement("span");
    button.append(buttonChild);
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(button, input, editable);

    expect(isShortcutSuppressed(new KeyboardEvent("keydown", { key: "j", bubbles: true }))).toBe(false);
    expect(isShortcutSuppressed(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }))).toBe(true);
    expect(isShortcutSuppressed(new KeyboardEvent("keydown", { key: "j", isComposing: true }))).toBe(true);

    const buttonEvent = new KeyboardEvent("keydown", { key: "j", bubbles: true });
    buttonChild.dispatchEvent(buttonEvent);
    expect(isShortcutSuppressed(buttonEvent)).toBe(true);

    const inputEvent = new KeyboardEvent("keydown", { key: "j", bubbles: true });
    input.dispatchEvent(inputEvent);
    expect(isShortcutSuppressed(inputEvent)).toBe(true);

    const editableEvent = new KeyboardEvent("keydown", { key: "j", bubbles: true });
    editable.dispatchEvent(editableEvent);
    expect(isShortcutSuppressed(editableEvent)).toBe(true);
  });

  it("keeps focus movement bounded at the feed edges", () => {
    expect(nextCardIndex(-1, 2, 1)).toBe(0);
    expect(nextCardIndex(-1, 2, -1)).toBe(1);
    expect(nextCardIndex(0, 2, -1)).toBe(0);
    expect(nextCardIndex(1, 2, 1)).toBe(1);
    expect(nextCardIndex(0, 0, 1)).toBe(-1);
  });
});

describe("feed keyboard behavior", () => {
  it("labels card actions and uses j/k to focus cards", async () => {
    await renderFeed();
    const cards = [...document.querySelectorAll("[data-video-card]")];

    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('button[aria-label="Watch First video"]')).not.toBeNull();
    expect(cards[0].querySelector('button[aria-label="Skip First video"]')).not.toBeNull();

    const firstJ = keydown(window, "j");
    expect(firstJ.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cards[0]);

    keydown(cards[0], "j");
    expect(document.activeElement).toBe(cards[1]);

    keydown(cards[1], "k");
    expect(document.activeElement).toBe(cards[0]);
    expect(cards[0].matches(":focus-visible")).toBe(true);
  });

  it("uses w and s only for the focused fresh live-feed card", async () => {
    const props = await renderFeed();
    const firstCard = document.querySelector('[data-video-card]');
    firstCard.focus();

    const watch = keydown(firstCard, "w");
    expect(watch.defaultPrevented).toBe(true);
    expect(props.setPlaying).toHaveBeenCalledWith("video-1");

    const skip = keydown(firstCard, "s");
    expect(skip.defaultPrevented).toBe(true);
    expect(props.mark).toHaveBeenCalledWith("video-1", "skipped");

    const watchButton = firstCard.querySelector('button[aria-label="Watch First video"]');
    watchButton.focus();
    const suppressed = keydown(watchButton, "s");
    expect(suppressed.defaultPrevented).toBe(false);
    expect(props.mark).toHaveBeenCalledTimes(1);
  });

  it("does not act on a cleared card", async () => {
    const cleared = [{ ...videos[0], status: "watched" }];
    const props = await renderFeed({ videos: cleared });
    const card = document.querySelector('[data-video-card]');
    card.focus();

    expect(keydown(card, "w").defaultPrevented).toBe(false);
    expect(keydown(card, "s").defaultPrevented).toBe(false);
    expect(props.setPlaying).not.toHaveBeenCalled();
    expect(props.mark).not.toHaveBeenCalled();
  });
});
