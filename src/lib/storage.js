/**
 * Local persistence for Slate (spec 001, R1).
 * Single versioned localStorage key. Demo mode must never call these —
 * the demo route stays stateless by design.
 */

const KEY = "slate.v1";
const VERSION = 1;

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    return {
      goals: Array.isArray(data.goals) ? data.goals : null,
      channels: Array.isArray(data.channels) ? data.channels : null,
      settings: data.settings && typeof data.settings === "object" ? data.settings : null,
      videos: Array.isArray(data.videos) ? data.videos : null,
      lastRefresh: data.lastRefresh ? new Date(data.lastRefresh) : null,
      history: Array.isArray(data.history) ? data.history : [],
    };
  } catch {
    return null;
  }
}

export function saveState({ goals, channels, settings, videos, lastRefresh, history }) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: VERSION,
        goals,
        channels,
        settings,
        videos,
        lastRefresh: lastRefresh instanceof Date ? lastRefresh.toISOString() : lastRefresh || null,
        history: (history || []).slice(-500),
      })
    );
  } catch {
    // Quota or privacy mode: persistence is best-effort, never fatal.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
