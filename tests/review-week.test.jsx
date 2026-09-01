import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewView } from "../src/views/ReviewView.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;

const now = new Date(2026, 7, 31, 12, 0, 0, 0);
const goals = [
  { id: "goal-1", name: "Design systems", weeklyMinutes: 5 },
  { id: "goal-2", name: "Field research", weeklyMinutes: 10 },
];
const history = [
  {
    id: "before-week",
    title: "Sunday watch",
    goalId: "goal-1",
    duration: 60,
    watchedAt: new Date(2026, 7, 30, 23, 59, 59, 999).toISOString(),
  },
  {
    id: "monday-watch",
    title: "Monday watch",
    goalId: "goal-1",
    duration: 60,
    watchedAt: new Date(2026, 7, 31, 0, 0, 0, 0).toISOString(),
  },
  {
    id: "tuesday-watch",
    title: "Tuesday watch",
    goalId: "goal-2",
    duration: 120,
    watchedAt: new Date(2026, 8, 1, 10, 0, 0, 0).toISOString(),
  },
  {
    id: "next-monday",
    title: "Next Monday watch",
    goalId: "goal-1",
    duration: 180,
    watchedAt: new Date(2026, 8, 7, 0, 0, 0, 0).toISOString(),
  },
  {
    id: "invalid-watch",
    title: "Invalid timestamp stays exportable",
    goalId: "goal-2",
    duration: 30,
    watchedAt: "not-a-timestamp",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("Review ISO week aggregation", () => {
  it("renders the local range, weekly totals, video count, and goal budgets together", async () => {
    await act(async () => root.render(<ReviewView history={history} goals={goals} />));

    const text = document.body.textContent;
    expect(text).toContain("2026-W36");
    expect(text).toContain("Aug 31");
    expect(text).toContain("Sep 6");
    expect(text).toContain("3 min");
    expect(text).toContain("Videos this week");
    expect(text).toContain("2Videos this week");
    expect(text).toContain("1 min / 5 min");
    expect(text).toContain("2 min / 10 min");
  });

  it("ignores invalid timestamps for weekly totals while retaining history and all-time totals", async () => {
    await act(async () => root.render(<ReviewView history={history} goals={goals} />));

    const text = document.body.textContent;
    expect(text).toContain("Watched all time");
    expect(text).toContain("8 min");
    expect(text).toContain("Invalid timestamp stays exportable");
    expect(text).not.toContain("Invalid timestamp stays exportable\n30 min");
  });

});
