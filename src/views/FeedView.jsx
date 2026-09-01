import { DEMO_MODE } from "../theme.js";
import { fmtMins } from "../lib/format.js";
import { Btn } from "../components/Btn.jsx";
import { GoalMeter } from "../components/GoalMeter.jsx";
import { VideoCard } from "../components/VideoCard.jsx";
import { SignOff } from "../components/SignOff.jsx";

export function FeedView({
  videos,
  activeGoals,
  settings,
  gate,
  loading,
  loadStep,
  error,
  refresh,
  playing,
  setPlaying,
  mark,
  quotaUsed,
  cacheStats,
}) {
  const fresh = videos.filter((v) => v.status === "fresh");
  const done = videos.filter((v) => v.status !== "fresh");
  const totalSec = fresh.reduce((s, v) => s + v.duration, 0);
  const watchedSec = videos
    .filter((v) => v.status === "watched")
    .reduce((s, v) => s + v.duration, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          {DEMO_MODE && (
            <p className="mb-1 font-mono text-[10px] text-honey-deep">
              SEEDED DEMO · NO ACCOUNTS, CREDENTIALS OR API CALLS
            </p>
          )}
          {videos.length > 0 ? (
            <p className="font-body text-[14px] text-ink-soft">
              Today's slate:{" "}
              <strong className="text-ink">
                {fresh.length} video{fresh.length !== 1 ? "s" : ""} · {fmtMins(totalSec)}
              </strong>{" "}
              remaining
              {done.length > 0 && ` · ${done.length} cleared`}
            </p>
          ) : (
            <p className="font-body text-[14px] text-ink-soft">No slate yet.</p>
          )}
          {quotaUsed > 0 && (
            <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
              ~{quotaUsed} / 10,000 daily API units used
              {cacheStats?.supabaseAvailable &&
                ` · cache ${cacheStats.videoHits || 0} video hits / ${cacheStats.scoreHits || 0} score hits`}
            </p>
          )}
        </div>
        <div className="text-right">
          {!DEMO_MODE && (
            <Btn onClick={() => refresh()} disabled={loading || !gate.allowed}>
              {loading ? "Programming..." : "New edition"}
            </Btn>
          )}
          {!DEMO_MODE && !gate.allowed && (
            <p className="mt-1 font-mono text-[10px] text-honey-deep">
              unlocks {gate.next?.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div
          className="rounded-lg border border-mist bg-card p-8 text-center"
        >
          <p className="font-display text-[18px] text-ink">{loadStep}</p>
          <p className="mt-2 text-xs text-ink-soft font-body">
            The first run may take a bit; cached runs should get faster.
          </p>
        </div>
      )}

      {error && (
        <div
          className="mb-6 rounded-lg border border-danger bg-[#fbefea] p-4 text-sm text-danger font-body"
        >
          {error}
        </div>
      )}

      {!loading && videos.length === 0 && !error && (
        <div
          className="rounded-lg border border-dashed border-mist bg-card p-12 text-center"
        >
          <p className="font-display text-[22px] text-ink">Nothing is scheduled.</p>
          <p className="mt-2 text-sm text-ink-soft font-body">
            Set your goals in Programming, then build your first slate.
          </p>
        </div>
      )}

      {!loading &&
        activeGoals.map((g, gi) => {
          const goalVids = [...videos.filter((v) => v.goalId === g.id)].sort(
            (a, b) => (b.score ?? 0) - (a.score ?? 0)
          );
          if (!goalVids.length) return null;
          // Front-page treatment (T7): the first goal's top story leads at
          // 2-of-3 columns; everything else flows in a fixed 3-up grid so no
          // dead column is left on wide screens.
          const leadId = gi === 0 && goalVids[0]?.status === "fresh" ? goalVids[0].id : null;
          return (
            <section key={g.id} className="mb-10">
              <GoalMeter goal={g} videos={videos} />
              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {goalVids.map((v) => (
                  <div key={v.id} className={v.id === leadId ? "md:col-span-2" : ""}>
                    <VideoCard
                      v={v}
                      playing={playing}
                      setPlaying={setPlaying}
                      mark={mark}
                      lead={v.id === leadId}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

      {!loading && videos.length > 0 && fresh.length === 0 && (
        <SignOff watchedSec={watchedSec} gate={gate} settings={settings} />
      )}
    </div>
  );
}
