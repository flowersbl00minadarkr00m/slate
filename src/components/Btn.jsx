import { C, BODY } from "../theme.js";

export function Btn({ children, onClick, kind = "solid", small, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-semibold uppercase tracking-wider transition-opacity ${small ? "px-4 py-2 text-[10px]" : "px-6 py-3 text-xs"} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-85"}`}
      style={
        kind === "solid"
          ? { background: C.pine, color: "#fff", fontFamily: BODY }
          : kind === "ghost"
            ? { background: "transparent", color: C.ink, border: `1px solid ${C.ink}`, fontFamily: BODY }
            : { background: C.honey, color: C.ink, fontFamily: BODY }
      }
    >
      {children}
    </button>
  );
}
