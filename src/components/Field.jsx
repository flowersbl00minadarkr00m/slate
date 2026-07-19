import { C, MONO } from "../theme.js";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span
        className="block mb-2 text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: C.ink, fontFamily: MONO }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
