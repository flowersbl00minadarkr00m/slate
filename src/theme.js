/* Design tokens and runtime flags shared across Slate's UI. */

export const C = {
  paper: "#F4F2EC",
  ink: "#111111",
  inkSoft: "#5D5B55",
  pine: "#111111",
  pineDeep: "#050505",
  honey: "#D9FF3F",
  honeyDeep: "#7D8F1A",
  mist: "#D7D2C7",
  card: "#FBFAF5",
  danger: "#B23A2E",
};

export const DISPLAY = "'Fraunces', Georgia, serif";
export const BODY = "'Inter', system-ui, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, monospace";

export const DEMO_MODE =
  import.meta.env.VITE_PUBLIC_DEMO === "true" ||
  new URLSearchParams(window.location.search).get("demo") === "1";

export const inputStyle = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 0,
  border: `1px solid ${C.ink}`,
  background: "#FFFDF7",
  color: C.ink,
  fontFamily: BODY,
  fontSize: 15,
  outline: "none",
};
