import { C } from "../theme.js";
import { fmtDur } from "../lib/format.js";

/* Bundled duotone cover art for demo cards (spec T8) — replaces the flat
   black placeholder. Deterministic geometric motif seeded from the title so
   each card is distinct, drawn in the paper/ink/honey palette. No network,
   no images. */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const MOTIFS = ["arcs", "grid", "rings", "bars"];

export function DemoCover({ v }) {
  const seed = hash(v.title || v.demoLabel || "slate");
  const motif = MOTIFS[seed % MOTIFS.length];
  const rot = (seed >> 3) % 4;
  const honey = C.honey;

  let art;
  if (motif === "arcs") {
    art = [0, 1, 2, 3, 4].map((i) => (
      <circle
        key={i}
        cx={160 - rot * 30}
        cy={110}
        r={20 + i * 26}
        fill="none"
        stroke={i % 2 ? honey : "#3a3a30"}
        strokeWidth={i % 2 ? 6 : 3}
      />
    ));
  } else if (motif === "grid") {
    art = [];
    for (let x = 0; x < 8; x++)
      for (let y = 0; y < 5; y++) {
        const on = (hash(`${x}-${y}-${seed}`) % 5) === 0;
        art.push(
          <rect
            key={`${x}-${y}`}
            x={x * 40 + 6}
            y={y * 40 + 6}
            width={28}
            height={28}
            fill={on ? honey : "transparent"}
            stroke="#3a3a30"
            strokeWidth={1}
          />
        );
      }
  } else if (motif === "rings") {
    art = [0, 1, 2].map((i) => (
      <circle key={i} cx={40 + i * 90} cy={110} r={44} fill="none" stroke={i === 1 ? honey : "#3a3a30"} strokeWidth={i === 1 ? 10 : 4} />
    ));
  } else {
    art = [0, 1, 2, 3, 4, 5, 6].map((i) => (
      <rect key={i} x={i * 44 + 8} y={140 - ((hash(`${i}-${seed}`) % 90) + 20)} width={30} height={120} fill={i % 3 === 0 ? honey : "#3a3a30"} />
    ));
  }

  return (
    <div className="relative w-full aspect-video bg-pine-deep overflow-hidden">
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {art}
      </svg>
      <div className="absolute inset-0 flex items-end justify-between p-3">
        <span className="font-mono text-[11px] tracking-[0.12em] text-white">
          {v.demoLabel || "SLATE DEMO"}
        </span>
        <span className="bg-honey px-1.5 py-0.5 font-mono text-[11px] text-ink">
          {fmtDur(v.duration)}
        </span>
      </div>
    </div>
  );
}
