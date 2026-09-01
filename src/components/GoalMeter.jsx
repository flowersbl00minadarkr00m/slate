import { fmtMins } from "../lib/format.js";

export function GoalMeter({ goal, videos }) {
  const dailySec = Math.round((goal.weeklyMinutes / 7) * 60);
  const goalVids = videos.filter((v) => v.goalId === goal.id);
  const programmed = goalVids.reduce((s, v) => s + v.duration, 0);
  const watched = goalVids
    .filter((v) => v.status === "watched")
    .reduce((s, v) => s + v.duration, 0);
  const pctProg = Math.min(100, (programmed / dailySec) * 100);
  const pctWatch = Math.min(100, (watched / dailySec) * 100);
  if (!goalVids.length) return null;
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="font-display text-[20px] font-semibold text-ink">
          {goal.name}
        </h3>
        <span className="font-mono text-[11px] text-ink-soft">
          {fmtMins(watched)} watched / {fmtMins(dailySec)} daily budget
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-mist">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#c5d4ce]"
          style={{ width: `${pctProg}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-honey"
          style={{ width: `${pctWatch}%` }}
        />
      </div>
    </div>
  );
}
