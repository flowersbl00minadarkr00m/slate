import { useCallback, useEffect, useMemo, useRef } from "react";
import { DEMO_MODE } from "../theme.js";
import { fmtMins } from "../lib/format.js";
import { formatTime } from "../lib/locale.js";
import { isShortcutSuppressed, nextCardIndex } from "../lib/keyboard.js";
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
  const cardRefs = useRef(new Map());
  const fresh = videos.filter((v) => v.status === "fresh");
  const done = videos.filter((v) => v.status !== "fresh");
  const totalSec = fresh.reduce((s, v) => s + v.duration, 0);
  const watchedSec = videos
    .filter((v) => v.status === "watched")
    .reduce((s, v) => s + v.duration, 0);
  const cardOrder = useMemo(
    () =>
      activeGoals.flatMap((goal) =>
        [...videos.filter((video) => video.goalId === goal.id)].sort(
          (a, b) => (b.score ?? 0) - (a.score ?? 0)
        )
      ),
    [activeGoals, videos]
  );

  const setCardRef = useCallback((id, element) => {
    if (element) cardRefs.current.set(id, element);
    else cardRefs.current.delete(id);
  }, []);

  useEffect(() => {
    function currentCardIndex() {
      return cardOrder.findIndex((video) => {
        const card = cardRefs.current.get(video.id);
        return card && (card === document.activeElement || card.contains(document.activeElement));
      });
    }

    function handleKeyDown(event) {
      if (isShortcutSuppressed(event)) return;

      const key = event.key?.toLowerCase();
      if (key === "j" || key === "k") {
        if (!cardOrder.length) return;
        event.preventDefault();
        const index = nextCardIndex(currentCardIndex(), cardOrder.length, key === "j" ? 1 : -1);
        cardRefs.current.get(cardOrder[index].id)?.focus();
        return;
      }

      if (key !== "w" && key !== "s") return;

      const video = cardOrder[currentCardIndex()];
      if (!video || video.status !== "fresh" || DEMO_MODE) return;

      event.preventDefault();
      if (key === "w") {
        if (playing === video.id) mark(video.id, "watched");
        else setPlaying(video.id);
      } else {
        mark(video.id, "skipped");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cardOrder, mark, playing, setPlaying]);

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
          <p
            className="mt-2 text-[11px] text-ink-soft font-mono"
            aria-label="Keyboard shortcuts: J and K move between cards. W watches the focused card. S skips it."
          >
            <kbd className="border border-mist bg-card px-1.5 py-0.5">J</kbd>/<kbd className="border border-mist bg-card px-1.5 py-0.5">K</kbd>{" "}
            move between cards {DEMO_MODE ? "· W/S act on fresh cards in a live feed" : "· W watch · S skip"}
          </p>
        </div>
        <div className="text-right">
          {!DEMO_MODE && (
            <Btn onClick={() => refresh()} disabled={loading || !gate.allowed}>
              {loading ? "Programming..." : "New edition"}
            </Btn>
          )}
          {!DEMO_MODE && !gate.allowed && (
            <p className="mt-1 font-mono text-[10px] text-honey-deep">
              unlocks {gate.next && formatTime(gate.next, { hour: "2-digit", minute: "2-digit" })}
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
                      cardRef={(element) => setCardRef(v.id, element)}
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
