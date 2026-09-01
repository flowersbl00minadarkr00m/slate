import { DEMO_MODE } from "../theme.js";
import { formatDate } from "../lib/locale.js";
import { Btn } from "./Btn.jsx";

/* Compressed single-band masthead (spec T7): wordmark + tagline + nav in
   ~180px so the first row of cards is visible above the fold. Tracking
   loosened to -0.04em — the old -0.08em clipped the final glyph. */
export function Masthead({ view, setView }) {
  return (
    <header className="mb-8 border-b border-ink pb-5">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-5">
          <h1
            className="font-display text-[clamp(48px,7vw,96px)] font-black uppercase leading-[0.85] tracking-[-0.04em] text-ink"
          >
            Slate
          </h1>
          <div className="pb-1.5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft font-mono"
            >
              Programmed media / finite feed
            </p>
            <p className="mt-1 text-lg leading-tight text-ink font-display">
              A feed that ends.
            </p>
            {DEMO_MODE && (
              <span
                className="mt-1.5 inline-block bg-honey px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink font-mono"
              >
                DEMO EDITION
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 pb-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft font-mono">
            {formatDate(new Date(), {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <nav className="flex gap-2">
            <Btn kind={view === "feed" ? "solid" : "ghost"} small onClick={() => setView("feed")}>
              Today's slate
            </Btn>
            {!DEMO_MODE && (
              <Btn kind={view === "review" ? "solid" : "ghost"} small onClick={() => setView("review")}>
                Review
              </Btn>
            )}
            <Btn kind={view === "settings" ? "solid" : "ghost"} small onClick={() => setView("settings")}>
              Programming
            </Btn>
          </nav>
        </div>
      </div>
    </header>
  );
}
