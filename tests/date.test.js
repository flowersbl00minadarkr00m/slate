import { describe, expect, it } from "vitest";
import { getLocalISOWeek } from "../src/lib/date.js";

function localDate(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function localParts(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
}

describe("local ISO week boundaries", () => {
  it("uses the same Monday-to-Sunday period for Monday and Sunday timestamps", () => {
    const monday = getLocalISOWeek(localDate(2026, 8, 31, 0));
    const sunday = getLocalISOWeek(localDate(2026, 9, 6, 23));

    expect(localParts(monday.start)).toEqual([2026, 8, 31, 0, 0]);
    expect(localParts(monday.end)).toEqual([2026, 9, 7, 0, 0]);
    expect(sunday.start.getTime()).toBe(monday.start.getTime());
    expect(sunday.end.getTime()).toBe(monday.end.getTime());
    expect(monday.isoYear).toBe(2026);
    expect(monday.isoWeek).toBe(36);
  });

  it("assigns January and December dates to the ISO year selected by Thursday", () => {
    expect(getLocalISOWeek(localDate(2025, 12, 31))).toMatchObject({ isoYear: 2026, isoWeek: 1 });
    expect(getLocalISOWeek(localDate(2026, 1, 1))).toMatchObject({ isoYear: 2026, isoWeek: 1 });
    expect(getLocalISOWeek(localDate(2027, 1, 1))).toMatchObject({ isoYear: 2026, isoWeek: 53 });
    expect(getLocalISOWeek(localDate(2026, 12, 31))).toMatchObject({ isoYear: 2026, isoWeek: 53 });
  });

  it("handles ISO week 53 and the following Monday boundary", () => {
    const week = getLocalISOWeek(localDate(2021, 1, 1));
    const nextWeek = getLocalISOWeek(localDate(2021, 1, 4, 0));

    expect(week).toMatchObject({ isoYear: 2020, isoWeek: 53 });
    expect(localParts(week.start)).toEqual([2020, 12, 28, 0, 0]);
    expect(localParts(week.end)).toEqual([2021, 1, 4, 0, 0]);
    expect(nextWeek).toMatchObject({ isoYear: 2021, isoWeek: 1 });
  });

  it("moves seven local calendar days across daylight-saving transition weeks", () => {
    for (const date of [localDate(2026, 3, 8), localDate(2026, 11, 1)]) {
      const week = getLocalISOWeek(date);
      const expectedEnd = new Date(week.start);
      expectedEnd.setDate(expectedEnd.getDate() + 7);

      expect(localParts(week.start).slice(3)).toEqual([0, 0]);
      expect(localParts(week.end).slice(3)).toEqual([0, 0]);
      expect(week.end.getTime()).toBe(expectedEnd.getTime());
    }
  });

  it("returns no week for an invalid reference date", () => {
    expect(getLocalISOWeek(new Date("not-a-timestamp"))).toBeNull();
  });
});
