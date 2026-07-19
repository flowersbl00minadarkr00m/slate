import { C, DISPLAY, MONO } from "../theme.js";
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
        <h3 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.ink }}>
          {goal.name}
        </h3>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}>
          {fmtMins(watched)} watched / {fmtMins(dailySec)} daily budget
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative" style={{ background: C.mist }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pctProg}%`, background: "#C5D4CE" }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pctWatch}%`, background: C.honey }}
        />
      </div>
    </div>
  );
}
