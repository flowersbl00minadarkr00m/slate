/*
 * Design tokens and runtime flags shared across Slate's UI.
 *
 * The palette and type values live in `src/styles/tokens.css` (Tailwind v4
 * `@theme`). The maps below reference those CSS custom properties so inline
 * `style={{ color: C.ink }}` and Tailwind utilities (`text-ink`) draw from one
 * source. Change a color in tokens.css and every consumer updates.
 */

export const C = {
  paper: "var(--color-paper)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  pine: "var(--color-pine)",
  pineDeep: "var(--color-pine-deep)",
  honey: "var(--color-honey)",
  honeyDeep: "var(--color-honey-deep)",
  mist: "var(--color-mist)",
  card: "var(--color-card)",
  danger: "var(--color-danger)",
};

export const DISPLAY = "var(--font-display)";
export const BODY = "var(--font-body)";
export const MONO = "var(--font-mono)";

export const DEMO_MODE =
  import.meta.env.VITE_PUBLIC_DEMO === "true" ||
  new URLSearchParams(window.location.search).get("demo") === "1";

export const inputStyle = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 0,
  border: `1px solid ${C.ink}`,
  background: "var(--color-field)",
  color: C.ink,
  fontFamily: BODY,
  fontSize: 15,
  outline: "none",
};
