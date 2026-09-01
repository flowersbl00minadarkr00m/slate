import { fmtMins, todayAt } from "../lib/format.js";

export function SignOff({ watchedSec, gate, settings }) {
  return (
    <div className="mt-8 rounded-lg bg-pine-deep px-8 py-16 text-center">
      <p className="font-mono text-[11px] tracking-[0.2em] text-honey">
        END OF TODAY'S SLATE
      </p>
      <h2 className="mt-3 font-display text-[36px] font-bold text-white">
        That's everything.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-[#c9d6d1] font-body">
        You watched {fmtMins(watchedSec)} of goal-aligned video. There is nothing else to scroll. The
        next edition airs at{" "}
        <span className="font-mono">
          {gate.next
            ? gate.next.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
            : settings.refreshTimes.find((t) => todayAt(t) > new Date()) || settings.refreshTimes[0]}
        </span>
        .
      </p>
      <p className="mt-6 font-display text-[14px] italic text-[#8fa89f]">
        Go make something.
      </p>
    </div>
  );
}
