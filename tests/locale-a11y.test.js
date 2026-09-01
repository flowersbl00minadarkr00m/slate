import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatTime, getBrowserLocale } from "../src/lib/locale.js";

const indexHtml = readFileSync("index.html", "utf8");
const indexCss = readFileSync("src/index.css", "utf8");
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("browser locale formatting", () => {
  it("uses navigator.language for dates and times", () => {
    vi.stubGlobal("navigator", { language: "de-DE" });
    const value = new Date(2026, 7, 31, 17, 5);

    expect(getBrowserLocale()).toBe("de-DE");
    expect(formatDate(value, { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("31.08.2026");
    expect(formatTime(value, { hour: "2-digit", minute: "2-digit" })).toBe("17:05");
  });

  it("uses a stable fallback when navigator.language is unavailable", () => {
    vi.stubGlobal("navigator", undefined);
    expect(getBrowserLocale()).toBe("en-CA");
    expect(formatDate(new Date(2026, 7, 31), { month: "short", day: "numeric" })).toContain("Aug");
  });
});

describe("offline and motion accessibility contract", () => {
  it("keeps fonts and the favicon local", () => {
    expect(indexHtml).toContain('href="/favicon.svg"');
    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(tokensCss).toContain("--font-display: Georgia");
    expect(tokensCss).toContain("--font-body: system-ui");
  });

  it("defines visible focus and reduced-motion behavior", () => {
    expect(indexCss).toContain(":focus-visible");
    expect(indexCss).toContain("prefers-reduced-motion: reduce");
    expect(indexCss).toContain("transition-duration: 0.01ms");
  });
});
