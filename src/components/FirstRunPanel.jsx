export function FirstRunPanel({ onCreateGoal }) {
  return (
    <section
      aria-labelledby="first-run-heading"
      className="mb-10 border border-ink bg-card p-6 shadow-[10px_10px_0_var(--color-ink)] md:p-8"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-soft font-mono">
        FIRST RUN
      </p>
      <h2 id="first-run-heading" className="mt-3 font-display text-[32px] font-extrabold text-ink">
        Start with a blank slate.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft font-body">
        This is your personal programming space. Create your first goal below, or open the read-only demo to see how a finished slate works.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-body">
        <a
          href="#first-goal"
          onClick={onCreateGoal}
          className="font-semibold text-ink underline underline-offset-4"
        >
          Create your first goal
        </a>
        <a className="font-semibold text-ink underline underline-offset-4" href="?demo=1">
          View demo
        </a>
      </div>
    </section>
  );
}
