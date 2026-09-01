import { C, BODY, DISPLAY, MONO } from "../theme.js";

export function FirstRunPanel({ onCreateGoal }) {
  return (
    <section
      aria-labelledby="first-run-heading"
      className="mb-10 p-6 md:p-8"
      style={{ background: C.card, border: `1px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: C.inkSoft, fontFamily: MONO }}>
        FIRST RUN
      </p>
      <h2 id="first-run-heading" className="mt-3" style={{ color: C.ink, fontFamily: DISPLAY, fontSize: 32, fontWeight: 800 }}>
        Start with a blank slate.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: C.inkSoft, fontFamily: BODY }}>
        This is your personal programming space. Create your first goal below, or open the read-only demo to see how a finished slate works.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs" style={{ fontFamily: BODY }}>
        <a
          className="font-semibold underline underline-offset-4"
          href="#first-goal"
          onClick={onCreateGoal}
          style={{ color: C.ink }}
        >
          Create your first goal
        </a>
        <a className="font-semibold underline underline-offset-4" href="?demo=1" style={{ color: C.pine }}>
          View demo
        </a>
      </div>
    </section>
  );
}
