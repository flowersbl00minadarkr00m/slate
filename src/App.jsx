import { useState, useMemo, useCallback, useEffect, useRef } from "react";

/* ============================================================
   SLATE — a finite, goal-aligned YouTube feed
   Design language: "broadcast day" — your feed is a programmed
   slate that airs at fixed times, fills a time budget, and ends.

   App.jsx owns state and handlers; presentation lives in
   components/ and views/, shared logic in lib/ and theme.js.
   ============================================================ */

import { C, MONO, DEMO_MODE } from "./theme.js";
import { nextUnlock, uid } from "./lib/format.js";
import { seedGoals, seedDemoVideos, defaultSettings } from "./lib/seeds.js";
import {
  clearState,
  createBackup,
  loadState,
  saveState,
  validateBackup,
} from "./lib/storage.js";
import { Masthead } from "./components/Masthead.jsx";
import { FirstRunPanel } from "./components/FirstRunPanel.jsx";
import { StorageNotice } from "./components/StorageNotice.jsx";
import { SettingsView } from "./views/SettingsView.jsx";
import { FeedView } from "./views/FeedView.jsx";
import { ReviewView } from "./views/ReviewView.jsx";

function blankState() {
  return {
    goals: [],
    channels: [],
    settings: { ...defaultSettings, refreshTimes: [...defaultSettings.refreshTimes] },
    videos: [],
    lastRefresh: null,
    history: [],
  };
}

function blankGoal() {
  return {
    id: uid(),
    name: "",
    description: "",
    keywords: "",
    endDate: "",
    weeklyMinutes: 60,
  };
}

function hydrateState(state) {
  const blank = blankState();
  return {
    goals: Array.isArray(state?.goals) ? state.goals : blank.goals,
    channels: Array.isArray(state?.channels) ? state.channels : blank.channels,
    settings: {
      ...blank.settings,
      ...(state?.settings && typeof state.settings === "object" ? state.settings : {}),
      refreshTimes: Array.isArray(state?.settings?.refreshTimes)
        ? state.settings.refreshTimes
        : blank.settings.refreshTimes,
    },
    videos: Array.isArray(state?.videos) ? state.videos : blank.videos,
    lastRefresh: state?.lastRefresh
      ? state.lastRefresh instanceof Date
        ? state.lastRefresh
        : new Date(state.lastRefresh)
      : blank.lastRefresh,
    history: Array.isArray(state?.history) ? state.history : blank.history,
  };
}

function initialStorageResult() {
  if (DEMO_MODE) return { status: "demo", state: null };
  return loadState();
}

function gateForStorage(result) {
  if (result.status === "ready") return "ready";
  if (result.status === "empty") return "empty";
  return "blocked";
}

function restoreErrorMessage(code) {
  if (code === "invalid-json") return "The selected file is not valid JSON.";
  if (code === "unsupported-version") return "The selected backup uses an unsupported Slate version.";
  if (code === "invalid-schema") return "The selected backup does not match the supported Slate format.";
  return "The selected file is not a Slate backup.";
}

function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function backupCounts(state) {
  return {
    state,
    goalCount: state.goals.length,
    videoCount: state.videos.length,
    historyCount: state.history.length,
  };
}

export default function App() {
  const [initialStorage] = useState(initialStorageResult);
  const initialState = DEMO_MODE ? hydrateState({ goals: seedGoals, videos: seedDemoVideos }) : hydrateState(initialStorage.state);
  const [view, setView] = useState(() =>
    DEMO_MODE ? "feed" : initialStorage.status === "ready" && initialState.videos.length ? "feed" : "settings"
  );
  const [goals, setGoals] = useState(initialState.goals);
  const [channels, setChannels] = useState(initialState.channels);
  const [settings, setSettings] = useState(initialState.settings);
  const [videos, setVideos] = useState(initialState.videos);
  const [lastRefresh, setLastRefresh] = useState(initialState.lastRefresh);
  const [history, setHistory] = useState(initialState.history);
  const [storageStatus, setStorageStatus] = useState(initialStorage);
  const [persistenceGate, setPersistenceGate] = useState(() => gateForStorage(initialStorage));
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [cacheStats, setCacheStats] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreError, setRestoreError] = useState("");
  const initialRenderRef = useRef(true);
  const skipNextSaveRef = useRef(false);
  const userMutationRef = useRef(false);
  const firstGoalFocusRef = useRef(false);

  const snapshot = useMemo(
    () => ({ goals, channels, settings, videos, lastRefresh, history }),
    [goals, channels, settings, videos, lastRefresh, history]
  );

  useEffect(() => {
    if (DEMO_MODE) return;
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (persistenceGate === "blocked") return;
    if (persistenceGate === "empty" && !userMutationRef.current) return;

    userMutationRef.current = false;
    const result = saveState(snapshot);
    if (result.ok && persistenceGate === "empty") {
      skipNextSaveRef.current = true;
      queueMicrotask(() => {
        setStorageStatus({ status: "ready", state: null });
        setPersistenceGate("ready");
      });
    } else if (!result.ok) {
      queueMicrotask(() => {
        setStorageStatus({ status: "unavailable", state: null, code: result.code });
        setPersistenceGate("blocked");
      });
    }
  }, [snapshot, persistenceGate]);

  const markUserMutation = useCallback(() => {
    userMutationRef.current = true;
  }, []);

  const setGoalsFromUser = useCallback(
    (update) => {
      markUserMutation();
      setGoals(update);
    },
    [markUserMutation]
  );

  const setChannelsFromUser = useCallback(
    (update) => {
      markUserMutation();
      setChannels(update);
    },
    [markUserMutation]
  );

  const setSettingsFromUser = useCallback(
    (update) => {
      markUserMutation();
      setSettings(update);
    },
    [markUserMutation]
  );

  const firstGoalRef = useCallback((element) => {
    if (!element || !firstGoalFocusRef.current) return;
    firstGoalFocusRef.current = false;
    element.focus();
  }, []);

  const createFirstGoal = useCallback(() => {
    if (goals.length) {
      firstGoalFocusRef.current = false;
      document.getElementById("first-goal")?.focus();
      return;
    }
    firstGoalFocusRef.current = true;
    setGoalsFromUser((current) => (current.length ? current : [blankGoal()]));
  }, [goals.length, setGoalsFromUser]);

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
        userMutationRef.current = true;
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

  const mark = useCallback(
    (id, status) => {
      userMutationRef.current = true;
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
    },
    [playing, videos]
  );

  const persistCurrentState = useCallback(() => {
    const result = saveState(snapshot);
    if (result.ok) {
      skipNextSaveRef.current = true;
      setStorageStatus({ status: "ready", state: null });
      setPersistenceGate("ready");
      return true;
    }
    skipNextSaveRef.current = false;
    setStorageStatus({ status: "unavailable", state: null, code: result.code });
    setPersistenceGate("blocked");
    return false;
  }, [snapshot]);

  const exportBackup = useCallback(() => {
    const backup = createBackup(snapshot);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    if (typeof URL.createObjectURL !== "function") {
      setStorageStatus({ status: "unavailable", state: null, code: "export-failed" });
      setPersistenceGate("blocked");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [snapshot]);

  const restoreFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRestoreError("");
    setRestorePreview(null);
    if (!file) return;

    try {
      const result = validateBackup(JSON.parse(await readFileText(file)));
      if (!result.ok) {
        setRestoreError(restoreErrorMessage(result.code));
        return;
      }
      setRestorePreview(backupCounts(result.state));
    } catch {
      setRestoreError(restoreErrorMessage("invalid-json"));
    }
  }, []);

  const confirmRestore = useCallback(() => {
    if (!restorePreview || !window.confirm("Replace current local Slate data with this backup?")) return;
    const restored = hydrateState(restorePreview.state);
    skipNextSaveRef.current = true;
    userMutationRef.current = false;
    setGoals(restored.goals);
    setChannels(restored.channels);
    setSettings(restored.settings);
    setVideos(restored.videos);
    setLastRefresh(restored.lastRefresh);
    setHistory(restored.history);

    const result = saveState(restored);
    if (result.ok) {
      setStorageStatus({ status: "ready", state: null });
      setPersistenceGate("ready");
    } else {
      setStorageStatus({ status: "unavailable", state: null, code: result.code });
      setPersistenceGate("blocked");
    }
    setRestorePreview(null);
    setRestoreError("");
  }, [restorePreview]);

  const resetAll = useCallback(() => {
    if (!window.confirm("Delete all local Slate data (goals, channels, rules, slate, history)?")) return;
    const result = clearState();
    if (!result.ok) {
      setStorageStatus({ status: "unavailable", state: null, code: result.code });
      setPersistenceGate("blocked");
      return;
    }
    const blank = blankState();
    skipNextSaveRef.current = true;
    userMutationRef.current = false;
    setGoals(blank.goals);
    setChannels(blank.channels);
    setSettings(blank.settings);
    setVideos(blank.videos);
    setLastRefresh(blank.lastRefresh);
    setHistory(blank.history);
    setQuotaUsed(0);
    setCacheStats(null);
    setError("");
    setStorageStatus({ status: "empty", state: null });
    setPersistenceGate("empty");
    setRestorePreview(null);
    setRestoreError("");
    setView("settings");
  }, []);

  const firstRun = storageStatus.status === "empty" && persistenceGate === "empty";

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      <div className="mx-auto px-6 py-8 md:px-10 md:py-10" style={{ maxWidth: 1320 }}>
        <Masthead view={view} setView={setView} />
        <StorageNotice status={storageStatus} onRetry={persistCurrentState} onExport={exportBackup} />
        {view === "settings" ? (
          <>
            {firstRun && <FirstRunPanel onCreateGoal={createFirstGoal} />}
            <SettingsView
              goals={goals}
              setGoals={setGoalsFromUser}
              channels={channels}
              setChannels={setChannelsFromUser}
              settings={settings}
              setSettings={setSettingsFromUser}
              firstGoalRef={firstGoalRef}
              activeGoals={activeGoals}
              loading={loading}
              refresh={refresh}
              resetAll={resetAll}
              onExport={exportBackup}
              onRestoreFile={restoreFile}
              restorePreview={restorePreview}
              restoreError={restoreError}
              onConfirmRestore={confirmRestore}
              onCancelRestore={() => {
                setRestorePreview(null);
                setRestoreError("");
              }}
              readOnly={DEMO_MODE}
            />
          </>
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
