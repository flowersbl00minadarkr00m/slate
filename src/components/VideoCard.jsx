import { DEMO_MODE } from "../theme.js";
import { fmtDur, fmtCount } from "../lib/format.js";
import { Btn } from "./Btn.jsx";
import { DemoCover } from "./DemoCover.jsx";

export function VideoCard({ v, playing, setPlaying, mark, lead = false }) {
  return (
    <article
      className={`overflow-hidden border border-ink bg-card ${v.status === "fresh" ? "" : "opacity-[0.45]"} ${lead ? "shadow-[10px_10px_0_var(--color-ink)]" : ""}`}
    >
      {playing === v.id && !DEMO_MODE ? (
        <div className="relative aspect-video">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${v.id}?autoplay=1`}
            title={v.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : v.thumb ? (
        <button type="button" className="block w-full relative group" onClick={() => setPlaying(v.id)}>
          <img src={v.thumb} alt="" className="w-full block grayscale group-hover:grayscale-0 transition-all" />
          <span
            className="absolute bottom-2 right-2 bg-honey px-2 py-1 text-[10px] font-bold text-ink font-mono"
          >
            {fmtDur(v.duration)}
          </span>
        </button>
      ) : (
        <DemoCover v={v} />
      )}
      <div className="p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-ink-soft font-mono">
          {lead ? "Lead story" : v.cache === "score" ? "Cached signal" : "Fresh signal"}
        </p>
        <h4
          className={`leading-[1.02] font-display font-extrabold tracking-[-0.04em] text-ink ${lead ? "text-[clamp(30px,3vw,42px)]" : "text-[28px]"}`}
        >
          {v.title}
        </h4>
        <p className="mt-1 text-xs text-ink-soft font-body">
          {v.channel}
        </p>
        <p className="mt-2 text-xs italic text-pine-deep font-body">
          {v.score}/100 — {v.why}
          {v.viewCount ? ` · ${fmtCount(v.viewCount)} views` : ""}
          {v.cache === "score" ? " · cached" : ""}
        </p>
        {v.status === "fresh" && !DEMO_MODE && (
          <div className="mt-3 flex gap-2">
            <Btn small onClick={() => (playing === v.id ? mark(v.id, "watched") : setPlaying(v.id))}>
              {playing === v.id ? "Mark watched" : "Watch"}
            </Btn>
            <Btn small kind="ghost" onClick={() => mark(v.id, "skipped")}>
              Skip
            </Btn>
          </div>
        )}
        {v.status !== "fresh" && (
          <p className="mt-3 text-xs text-ink-soft font-mono">
            {v.status === "watched" ? "✓ watched" : "— skipped"}
          </p>
        )}
      </div>
    </article>
  );
}
