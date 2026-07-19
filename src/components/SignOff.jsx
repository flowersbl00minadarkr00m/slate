import { C, DISPLAY, BODY, MONO } from "../theme.js";
import { fmtMins, todayAt } from "../lib/format.js";

export function SignOff({ watchedSec, gate, settings }) {
  return (
    <div className="rounded-lg text-center py-16 px-8 mt-8" style={{ background: C.pineDeep }}>
      <p style={{ fontFamily: MONO, fontSize: 11, color: C.honey, letterSpacing: "0.2em" }}>
        END OF TODAY'S SLATE
      </p>
      <h2 className="mt-3" style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, color: "#fff" }}>
        That's everything.
      </h2>
      <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "#C9D6D1", fontFamily: BODY }}>
        You watched {fmtMins(watchedSec)} of goal-aligned video. There is nothing else to scroll. The
        next edition airs at{" "}
        <span style={{ fontFamily: MONO }}>
          {gate.next
            ? gate.next.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
            : settings.refreshTimes.find((t) => todayAt(t) > new Date()) || settings.refreshTimes[0]}
        </span>
        .
      </p>
      <p
        className="mt-6"
        style={{ fontFamily: DISPLAY, fontStyle: "italic", color: "#8FA89F", fontSize: 14 }}
      >
        Go make something.
      </p>
    </div>
  );
}
