import { C, DISPLAY, MONO, DEMO_MODE } from "../theme.js";
import { Btn } from "./Btn.jsx";

/* Compressed single-band masthead (spec T7): wordmark + tagline + nav in
   ~180px so the first row of cards is visible above the fold. Tracking
   loosened to -0.04em — the old -0.08em clipped the final glyph. */
export function Masthead({ view, setView }) {
  return (
    <header className="pb-5 mb-8" style={{ borderBottom: `1px solid ${C.ink}` }}>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-5">
          <h1
            className="leading-[0.85] uppercase"
            style={{
              fontFamily: DISPLAY,
              fontWeight: 900,
              fontSize: "clamp(48px, 7vw, 96px)",
              letterSpacing: "-0.04em",
              color: C.ink,
            }}
          >
            Slate
          </h1>
          <div className="pb-1.5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: C.inkSoft, fontFamily: MONO }}
            >
              Programmed media / finite feed
            </p>
            <p className="mt-1 text-lg leading-tight" style={{ color: C.ink, fontFamily: DISPLAY }}>
              A feed that ends.
            </p>
            {DEMO_MODE && (
              <span
                className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ background: C.honey, color: C.ink, fontFamily: MONO }}
              >
                DEMO EDITION
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 pb-1.5">
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: C.inkSoft, fontFamily: MONO }}>
            {new Date().toLocaleDateString("en-CA", {
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
