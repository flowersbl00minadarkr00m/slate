import { fmtMins } from "../lib/format.js";
import { getLocalISOWeek } from "../lib/date.js";

/* Review view (spec T5): what the broadcast day added up to. Reads the
   persisted watch history — no new state, no external calls. */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayStreak(history) {
  if (!history.length) return 0;
  const days = new Set(history.map((h) => startOfDay(h.watchedAt).getTime()));
  let streak = 0;
  const cursor = startOfDay(new Date());
  // Allow the streak to count from today or yesterday (a not-yet-watched today
  // shouldn't zero a run the user is mid-way through).
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function Stat({ value, label }) {
  return (
    <div className="border border-ink bg-card px-[22px] py-5">
      <p className="font-display text-[44px] font-black leading-none text-ink">{value}</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink-soft font-mono">
        {label}
      </p>
    </div>
  );
}

export function ReviewView({ history, goals }) {
  const week = getLocalISOWeek(new Date());
  const thisWeek = history.filter((h) => {
    const watchedAt = new Date(h.watchedAt);
    const watchedTime = watchedAt.getTime();
    return Number.isFinite(watchedTime) && watchedTime >= week.start.getTime() && watchedTime < week.end.getTime();
  });

  const minutesByGoalWeek = new Map();
  for (const h of thisWeek) {
    minutesByGoalWeek.set(h.goalId, (minutesByGoalWeek.get(h.goalId) || 0) + h.duration);
  }

  const totalSec = history.reduce((s, h) => s + h.duration, 0);
  const weekSec = thisWeek.reduce((s, h) => s + h.duration, 0);
  const streak = dayStreak(history);

  if (!history.length) {
    return (
      <div className="rounded-lg border border-dashed border-mist bg-card p-12 text-center">
        <p className="font-display text-[22px] text-ink">Nothing watched yet.</p>
        <p className="mt-2 text-sm text-ink-soft font-body">
          Mark videos watched on your slate and this page tallies your week by goal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <h2
          className="mb-6 font-display text-[clamp(40px,7vw,84px)] font-black uppercase leading-none tracking-[-0.06em] text-ink"
        >
          The week
        </h2>
        <p className="-mt-4 mb-6 text-sm text-ink-soft font-mono">
          {week.label}
        </p>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Stat value={fmtMins(weekSec)} label="Watched this week" />
          <Stat value={thisWeek.length} label="Videos this week" />
          <Stat value={`${streak}d`} label="Day streak" />
          <Stat value={fmtMins(totalSec)} label="Watched all time" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 font-display text-[24px] font-semibold text-ink">
          This week against budget
        </h3>
        <div className="space-y-4">
          {goals.map((g) => {
            const watched = minutesByGoalWeek.get(g.id) || 0;
            const budgetSec = g.weeklyMinutes * 60;
            const pct = budgetSec ? Math.min(100, (watched / budgetSec) * 100) : 0;
            const met = watched >= budgetSec && budgetSec > 0;
            return (
              <div key={g.id}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <h4 className="font-display text-[18px] font-semibold text-ink">{g.name}</h4>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {fmtMins(watched)} / {g.weeklyMinutes} min {met ? "· met ✓" : ""}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-mist">
                  <div
                    className={`h-full rounded-full ${met ? "bg-honey-deep" : "bg-honey"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
            <p className="text-sm text-ink-soft font-body">
              No active goals to measure against.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-4 font-display text-[24px] font-semibold text-ink">
          Recently watched
        </h3>
        <div className="border border-mist">
          {[...history]
            .slice(-12)
            .reverse()
            .map((h, i) => (
              <div
                key={`${h.id}-${i}`}
                className={`flex items-baseline justify-between gap-4 px-4 py-3 ${i === Math.min(11, history.length - 1) ? "" : "border-b border-mist"}`}
              >
                <span className="font-body text-[14px] text-ink">{h.title}</span>
                <span className="whitespace-nowrap font-mono text-[11px] text-ink-soft">
                  {fmtMins(h.duration)} ·{" "}
                  {new Date(h.watchedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
