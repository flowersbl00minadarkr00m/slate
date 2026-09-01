import { describe, expect, it } from "vitest";
import { buildSlate } from "../api/lib/slate-builder.js";

const makeVideo = (overrides = {}) => ({
  id: "video",
  title: "A useful video",
  channel: "A channel",
  description: "",
  duration: 60,
  goalId: "goal-a",
  score: 80,
  ...overrides,
});

describe("buildSlate", () => {
  it("filters weak scores and stops adding videos after a goal's daily budget", () => {
    const goals = [
      { id: "goal-a", weeklyMinutes: 14 },
      { id: "goal-b", weeklyMinutes: 7 },
    ];

    const slate = buildSlate(
      [
        makeVideo({ id: "alpha-best", goalId: "goal-a", score: 90, duration: 120 }),
        makeVideo({ id: "alpha-over-budget", goalId: "goal-a", score: 89, duration: 30 }),
        makeVideo({ id: "beta-best", goalId: "goal-b", score: 95, duration: 30 }),
        makeVideo({ id: "weak-match", goalId: "goal-a", score: 54, duration: 30 }),
      ],
      goals,
      { feedCap: 10 }
    );

    expect(slate.map((video) => video.id)).toEqual(["beta-best", "alpha-best"]);
    expect(slate.every((video) => video.status === "fresh")).toBe(true);
  });

  it("sorts the final slate by score and applies the global feed cap", () => {
    const slate = buildSlate(
      [
        makeVideo({ id: "first", score: 88 }),
        makeVideo({ id: "second", score: 97 }),
        makeVideo({ id: "third", score: 76 }),
      ],
      [{ id: "goal-a", weeklyMinutes: 60 }],
      { feedCap: 2 }
    );

    expect(slate.map((video) => video.id)).toEqual(["second", "first"]);
  });
});
