import { useState, useMemo, useCallback, useEffect } from "react";

/* ============================================================
   SLATE — a finite, goal-aligned YouTube feed
   Design language: "broadcast day" — your feed is a programmed
   slate that airs at fixed times, fills a time budget, and ends.

   App.jsx owns state and handlers; presentation lives in
   components/ and views/, shared logic in lib/ and theme.js.
   ============================================================ */

import { C, MONO, DEMO_MODE } from "./theme.js"; // DEMO_MODE gates read-only Programming
import { nextUnlock } from "./lib/format.js";
import { seedGoals, seedDemoVideos, defaultSettings } from "./lib/seeds.js";
import { loadState, saveState, clearState } from "./lib/storage.js";
import { Masthead } from "./components/Masthead.jsx";
import { SettingsView } from "./views/SettingsView.jsx";
import { FeedView } from "./views/FeedView.jsx";
import { ReviewView } from "./views/ReviewView.jsx";

const persisted = DEMO_MODE ? null : loadState();

export default function App() {
  const [view, setView] = useState(
    DEMO_MODE ? "feed" : persisted?.videos?.length ? "feed" : "settings"
  );
  const [goals, setGoals] = useState(persisted?.goals ?? seedGoals);
  const [channels, setChannels] = useState(persisted?.channels ?? []);
  const [settings, setSettings] = useState(
    persisted?.settings ? { ...defaultSettings, ...persisted.settings } : defaultSettings
  );
  const [videos, setVideos] = useState(DEMO_MODE ? seedDemoVideos : (persisted?.videos ?? []));
  const [lastRefresh, setLastRefresh] = useState(persisted?.lastRefresh ?? null);
  const [history, setHistory] = useState(persisted?.history ?? []);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [cacheStats, setCacheStats] = useState(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    saveState({ goals, channels, settings, videos, lastRefresh, history });
  }, [goals, channels, settings, videos, lastRefresh, history]);

  const activeGoals = useMemo(
    () => goals.filter((g) => !g.endDate || new Date(g.endDate) >= new Date()),
    [goals]
  );

  const gate = nextUnlock(settings.refreshTimes, lastRefresh);

  const refresh = useCallback(
    async (force = false) => {
      setError("");
      if (!force && !gate.allowed) return;
      setLoading(true);
      try {
        setLoadStep("Programming today's slate from server-side sources...");
        const res = await fetch("/api/build-slate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goals: activeGoals, channels, settings, force }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Slate build failed (${res.status})`);
        setVideos(data.videos || []);
        setQuotaUsed(data.quotaUsed || 0);
        setCacheStats(data.cacheStats || null);
        setLastRefresh(new Date());
        setView("feed");
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
        setLoadStep("");
      }
    },
    [activeGoals, channels, settings, gate.allowed]
  );

  const mark = (id, status) => {
    if (status === "watched") {
      const v = videos.find((x) => x.id === id);
      if (v) {
        setHistory((h) => [
          ...h,
          { id: v.id, title: v.title, goalId: v.goalId, duration: v.duration, watchedAt: new Date().toISOString() },
        ]);
      }
    }
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, status } : v)));
    if (playing === id) setPlaying(null);
  };

  const resetAll = () => {
    if (!window.confirm("Delete all local Slate data (goals, channels, rules, slate, history)?")) return;
    clearState();
    setGoals(seedGoals);
    setChannels([]);
    setSettings(defaultSettings);
    setVideos([]);
    setLastRefresh(null);
    setHistory([]);
    setView("settings");
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      <div className="mx-auto px-6 py-8 md:px-10 md:py-10" style={{ maxWidth: 1320 }}>
        <Masthead view={view} setView={setView} />
        {view === "settings" ? (
          <SettingsView
            goals={goals}
            setGoals={setGoals}
            channels={channels}
            setChannels={setChannels}
            settings={settings}
            setSettings={setSettings}
            activeGoals={activeGoals}
            loading={loading}
            refresh={refresh}
            resetAll={resetAll}
            readOnly={DEMO_MODE}
          />
        ) : view === "review" ? (
          <ReviewView history={history} goals={activeGoals} />
        ) : (
          <FeedView
            videos={videos}
            activeGoals={activeGoals}
            settings={settings}
            gate={gate}
            loading={loading}
            loadStep={loadStep}
            error={error}
            refresh={refresh}
            playing={playing}
            setPlaying={setPlaying}
            mark={mark}
            quotaUsed={quotaUsed}
            cacheStats={cacheStats}
          />
        )}
        <footer
          className="mt-16 pt-4 text-xs flex justify-between"
          style={{ borderTop: `1px solid ${C.mist}`, color: C.inkSoft, fontFamily: MONO }}
        >
          <span>Slate — the feed that ends</span>
          <span>{DEMO_MODE ? "seeded demo · no external requests" : "local-first · your data stays in this browser"}</span>
        </footer>
      </div>
    </div>
  );
}
