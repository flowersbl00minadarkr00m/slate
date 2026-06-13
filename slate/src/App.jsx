import { useState, useMemo, useCallback } from "react";

/* ============================================================
   SLATE — a finite, goal-aligned YouTube feed
   Design language: "broadcast day" — your feed is a programmed
   slate that airs at fixed times, fills a time budget, and ends.
   ============================================================ */

const C = {
  paper: "#FAFAF7",
  ink: "#1C2826",
  inkSoft: "#4A5853",
  pine: "#2E5E52",
  pineDeep: "#1F4239",
  honey: "#D9A441",
  honeyDeep: "#B5832B",
  mist: "#E4E7E2",
  card: "#FFFFFF",
  danger: "#A4452F",
};

const DISPLAY = "'Fraunces', Georgia, serif";
const BODY = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/* ---------- helpers ---------- */

const uid = () => Math.random().toString(36).slice(2, 9);

function parseISODuration(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || 0) * 3600 + parseInt(m[2] || 0) * 60 + parseInt(m[3] || 0);
}

function fmtDur(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtMins(sec) {
  return `${Math.round(sec / 60)} min`;
}

function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function nextUnlock(refreshTimes, lastRefresh) {
  const now = new Date();
  const times = refreshTimes.map(todayAt).sort((a, b) => a - b);
  if (!lastRefresh) return { allowed: true };
  const passedSince = times.find((t) => t > lastRefresh && t <= now);
  if (passedSince) return { allowed: true };
  const upcoming = times.find((t) => t > now);
  if (upcoming) return { allowed: false, next: upcoming };
  const tomorrow = todayAt(refreshTimes.sort()[0]);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { allowed: false, next: tomorrow };
}

/* ---------- seed data ---------- */

const seedGoals = [
  {
    id: uid(),
    name: "AI governance & assurance",
    description:
      "Enterprise AI governance, AI risk and controls, ISO 42001, SOC 2 for AI systems, agent oversight, policy engines. Practitioner depth over hype.",
    keywords: "AI governance ISO 42001, AI agent risk controls",
    endDate: "2026-09-30",
    weeklyMinutes: 120,
  },
  {
    id: uid(),
    name: "Basketball film & analysis",
    description:
      "NBA and FIBA tactical breakdowns, roster construction, draft analysis. Film study and strategy, not trade rumors or drama.",
    keywords: "NBA film breakdown, FIBA tactical analysis",
    endDate: "2026-09-30",
    weeklyMinutes: 60,
  },
];

const defaultSettings = {
  minLengthMin: 8,
  blockShorts: true,
  feedCap: 12,
  refreshTimes: ["07:00", "17:00"],
  lookbackDays: 14,
};

/* ---------- YouTube API ---------- */

const YT = "https://www.googleapis.com/youtube/v3";

async function ytFetch(path, params, apiKey) {
  const qs = new URLSearchParams({ ...params, key: apiKey }).toString();
  const res = await fetch(`${YT}/${path}?${qs}`);
  const data = await res.json();
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || res.status;
    throw new Error(`YouTube API: ${reason}`);
  }
  return data;
}

async function searchVideos(query, apiKey, lookbackDays) {
  const publishedAfter = new Date(Date.now() - lookbackDays * 86400000).toISOString();
  const data = await ytFetch(
    "search",
    {
      part: "snippet",
      type: "video",
      maxResults: "15",
      q: query,
      order: "relevance",
      publishedAfter,
      relevanceLanguage: "en",
    },
    apiKey
  );
  return (data.items || []).map((i) => i.id.videoId).filter(Boolean);
}

async function channelUploads(handleOrId, apiKey) {
  const isId = /^UC[\w-]{20,}$/.test(handleOrId.trim());
  const param = isId
    ? { id: handleOrId.trim() }
    : { forHandle: handleOrId.trim().replace(/^@/, "") };
  const ch = await ytFetch("channels", { part: "contentDetails", ...param }, apiKey);
  const playlist = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlist) return [];
  const pl = await ytFetch(
    "playlistItems",
    { part: "contentDetails", playlistId: playlist, maxResults: "10" },
    apiKey
  );
  return (pl.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
}

async function videoDetails(ids, apiKey) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await ytFetch(
      "videos",
      { part: "snippet,contentDetails", id: batch.join(",") },
      apiKey
    );
    for (const v of data.items || []) {
      out.push({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        description: (v.snippet.description || "").slice(0, 300),
        thumb: v.snippet.thumbnails?.medium?.url,
        published: v.snippet.publishedAt,
        duration: parseISODuration(v.contentDetails.duration),
      });
    }
  }
  return out;
}

/* ---------- relevance scoring (via serverless proxy) ----------
   The Claude call happens server-side in /api/score so the API
   key never reaches the browser. The client only sends the bits
   of metadata the scorer needs.
------------------------------------------------------------------ */

async function scoreBatch(videos, goals) {
  const res = await fetch("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videos: videos.map((v) => ({
        title: v.title,
        channel: v.channel,
        description: v.description,
      })),
      goals: goals.map((g) => ({ id: g.id, name: g.name, description: g.description })),
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Scoring failed (${res.status})`);
  }
  const data = await res.json();
  return data.scored || [];
}

async function scoreAll(videos, goals) {
  const CHUNK = 10;
  const scored = [];
  for (let i = 0; i < videos.length; i += CHUNK) {
    const chunk = videos.slice(i, i + CHUNK);
    const results = await scoreBatch(chunk, goals);
    for (const r of results) {
      const v = chunk[r.i];
      if (v) scored.push({ ...v, goalId: r.g, score: r.s, why: r.w });
    }
  }
  return scored;
}

/* ---------- slate builder (the anti-doomscroll core) ---------- */

function buildSlate(scored, goals, settings) {
  const MIN_SCORE = 55;
  const eligible = scored.filter((v) => v.score >= MIN_SCORE);
  const slate = [];
  for (const g of goals) {
    let budget = Math.round((g.weeklyMinutes / 7) * 60); // daily seconds
    const candidates = eligible
      .filter((v) => v.goalId === g.id)
      .sort((a, b) => b.score - a.score);
    for (const v of candidates) {
      if (budget <= 0) break;
      slate.push({ ...v, status: "fresh" });
      budget -= v.duration;
    }
  }
  return slate.sort((a, b) => b.score - a.score).slice(0, settings.feedCap);
}

/* ============================================================
   UI
   ============================================================ */

export default function App() {
  const [view, setView] = useState("settings");
  const [apiKey, setApiKey] = useState("");
  const [goals, setGoals] = useState(seedGoals);
  const [channels, setChannels] = useState([]);
  const [channelInput, setChannelInput] = useState("");
  const [settings, setSettings] = useState(defaultSettings);
  const [videos, setVideos] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [quotaUsed, setQuotaUsed] = useState(0);

  const activeGoals = useMemo(
    () => goals.filter((g) => !g.endDate || new Date(g.endDate) >= new Date()),
    [goals]
  );

  const gate = nextUnlock(settings.refreshTimes, lastRefresh);

  const refresh = useCallback(
    async (force = false) => {
      setError("");
      if (!apiKey) {
        setError("Add your YouTube Data API key in settings first.");
        setView("settings");
        return;
      }
      if (!force && !gate.allowed) return;
      setLoading(true);
      let quota = 0;
      try {
        // 1. Goal-driven searches (primary source)
        setLoadStep("Searching for goal-aligned videos…");
        const ids = new Set();
        for (const g of activeGoals) {
          const queries = g.keywords
            .split(",")
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 2);
          for (const q of queries) {
            const found = await searchVideos(q, apiKey, settings.lookbackDays);
            quota += 100;
            found.forEach((id) => ids.add(id));
          }
        }
        // 2. Channel uploads (secondary source; origin is NOT a ranking factor)
        if (channels.length) {
          setLoadStep("Pulling channel uploads…");
          for (const ch of channels) {
            try {
              const found = await channelUploads(ch, apiKey);
              quota += 2;
              found.forEach((id) => ids.add(id));
            } catch {
              /* skip bad channel */
            }
          }
        }
        // 3. Details + length / Shorts filter
        setLoadStep("Filtering by length…");
        const details = await videoDetails([...ids], apiKey);
        quota += Math.ceil(ids.size / 50);
        const minSec = settings.minLengthMin * 60;
        const filtered = details.filter((v) => {
          if (settings.blockShorts && v.duration < 180) return false;
          return v.duration >= minSec;
        });
        // 4. Relevance scoring
        setLoadStep(`Scoring ${filtered.length} videos against your goals…`);
        const scored = await scoreAll(filtered, activeGoals);
        // 5. Build the finite slate
        setLoadStep("Programming today's slate…");
        const slate = buildSlate(scored, activeGoals, settings);
        setVideos(slate);
        setQuotaUsed(quota);
        setLastRefresh(new Date());
        setView("feed");
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
        setLoadStep("");
      }
    },
    [apiKey, activeGoals, channels, settings, gate.allowed]
  );

  const mark = (id, status) => {
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, status } : v)));
    if (playing === id) setPlaying(null);
  };

  const fresh = videos.filter((v) => v.status === "fresh");
  const done = videos.filter((v) => v.status !== "fresh");
  const totalSec = fresh.reduce((s, v) => s + v.duration, 0);
  const watchedSec = videos
    .filter((v) => v.status === "watched")
    .reduce((s, v) => s + v.duration, 0);

  /* ---------- shared bits ---------- */

  const Btn = ({ children, onClick, kind = "solid", small, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md font-medium transition-opacity ${small ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-85"}`}
      style={
        kind === "solid"
          ? { background: C.pine, color: "#fff", fontFamily: BODY }
          : kind === "ghost"
          ? { background: "transparent", color: C.inkSoft, border: `1px solid ${C.mist}`, fontFamily: BODY }
          : { background: C.honey, color: C.ink, fontFamily: BODY }
      }
    >
      {children}
    </button>
  );

  const Field = ({ label, children }) => (
    <label className="block">
      <span
        className="block mb-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: C.inkSoft, fontFamily: BODY, letterSpacing: "0.08em" }}
      >
        {label}
      </span>
      {children}
    </label>
  );

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.mist}`,
    background: C.card,
    color: C.ink,
    fontFamily: BODY,
    fontSize: 14,
    outline: "none",
  };

  /* ---------- masthead ---------- */

  const Masthead = () => (
    <header
      className="flex items-end justify-between pb-5 mb-8"
      style={{ borderBottom: `3px solid ${C.ink}` }}
    >
      <div>
        <h1
          className="leading-none"
          style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, color: C.ink }}
        >
          Slate
        </h1>
        <p className="mt-1 text-sm" style={{ color: C.inkSoft, fontFamily: BODY }}>
          A feed that ends.{" "}
          <span style={{ fontFamily: MONO, fontSize: 12 }}>
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </p>
      </div>
      <nav className="flex gap-2">
        <Btn kind={view === "feed" ? "solid" : "ghost"} small onClick={() => setView("feed")}>
          Today's slate
        </Btn>
        <Btn kind={view === "settings" ? "solid" : "ghost"} small onClick={() => setView("settings")}>
          Programming
        </Btn>
      </nav>
    </header>
  );

  /* ---------- settings view ---------- */

  const SettingsView = () => (
    <div className="space-y-10">
      <section>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>
          Connection
        </h2>
        <div className="mt-4 max-w-xl">
          <Field label="YouTube Data API key">
            <input
              style={inputStyle}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza…"
            />
          </Field>
          <p className="mt-2 text-xs" style={{ color: C.inkSoft, fontFamily: BODY }}>
            Free from Google Cloud Console → enable "YouTube Data API v3" → create an API key. Stays
            in this session only. The Claude scoring key lives on the server, not here.
          </p>
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>Goals</h2>
        <p className="mt-1 text-sm" style={{ color: C.inkSoft, fontFamily: BODY }}>
          Each goal gets a weekly time budget. The slate is programmed to fill it — and stop.
        </p>
        <div className="mt-4 space-y-4">
          {goals.map((g) => (
            <div
              key={g.id}
              className="rounded-lg p-5"
              style={{ background: C.card, border: `1px solid ${C.mist}` }}
            >
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Goal name">
                  <input
                    style={inputStyle}
                    value={g.name}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                </Field>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Field label="Ends">
                    <input
                      style={inputStyle}
                      type="date"
                      value={g.endDate}
                      onChange={(e) =>
                        setGoals((gs) =>
                          gs.map((x) => (x.id === g.id ? { ...x, endDate: e.target.value } : x))
                        )
                      }
                    />
                  </Field>
                  <Field label="Weekly budget (min)">
                    <input
                      style={inputStyle}
                      type="number"
                      min="10"
                      value={g.weeklyMinutes}
                      onChange={(e) =>
                        setGoals((gs) =>
                          gs.map((x) => (x.id === g.id ? { ...x, weeklyMinutes: +e.target.value } : x))
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="What counts (used by the relevance scorer)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                    value={g.description}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, description: e.target.value } : x))
                      )
                    }
                  />
                </Field>
                <Field label="Search queries (comma-separated, max 2 used)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                    value={g.keywords}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, keywords: e.target.value } : x))
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-3 text-right">
                <button
                  onClick={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))}
                  className="text-xs hover:opacity-70"
                  style={{ color: C.danger, fontFamily: BODY }}
                >
                  Remove goal
                </button>
              </div>
            </div>
          ))}
          <Btn
            kind="ghost"
            onClick={() =>
              setGoals((gs) => [
                ...gs,
                {
                  id: uid(),
                  name: "New goal",
                  description: "",
                  keywords: "",
                  endDate: "",
                  weeklyMinutes: 60,
                },
              ])
            }
          >
            + Add goal
          </Btn>
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>Channels</h2>
        <p className="mt-1 text-sm" style={{ color: C.inkSoft, fontFamily: BODY }}>
          Uploads from these channels join the candidate pool. They're ranked on relevance alone — no
          home-team advantage.
        </p>
        <div className="mt-4 flex gap-2 max-w-xl">
          <input
            style={inputStyle}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="@handle or channel ID (UC…)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && channelInput.trim()) {
                setChannels((cs) => [...cs, channelInput.trim()]);
                setChannelInput("");
              }
            }}
          />
          <Btn
            kind="ghost"
            onClick={() => {
              if (channelInput.trim()) {
                setChannels((cs) => [...cs, channelInput.trim()]);
                setChannelInput("");
              }
            }}
          >
            Add
          </Btn>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {channels.map((ch, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              style={{ background: C.mist, color: C.ink, fontFamily: MONO }}
            >
              {ch}
              <button
                onClick={() => setChannels((cs) => cs.filter((_, j) => j !== i))}
                style={{ color: C.inkSoft }}
                className="hover:opacity-70"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>The rules</h2>
        <div className="mt-4 grid gap-4 max-w-3xl" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Field label="Min length (min)">
            <input
              style={inputStyle}
              type="number"
              min="0"
              value={settings.minLengthMin}
              onChange={(e) => setSettings((s) => ({ ...s, minLengthMin: +e.target.value }))}
            />
          </Field>
          <Field label="Slate cap (videos)">
            <input
              style={inputStyle}
              type="number"
              min="3"
              max="30"
              value={settings.feedCap}
              onChange={(e) => setSettings((s) => ({ ...s, feedCap: +e.target.value }))}
            />
          </Field>
          <Field label="Morning edition">
            <input
              style={inputStyle}
              type="time"
              value={settings.refreshTimes[0]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [e.target.value, s.refreshTimes[1]] }))
              }
            />
          </Field>
          <Field label="Evening edition">
            <input
              style={inputStyle}
              type="time"
              value={settings.refreshTimes[1]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [s.refreshTimes[0], e.target.value] }))
              }
            />
          </Field>
        </div>
        <label
          className="mt-4 flex items-center gap-3 text-sm"
          style={{ fontFamily: BODY, color: C.ink }}
        >
          <input
            type="checkbox"
            checked={settings.blockShorts}
            onChange={(e) => setSettings((s) => ({ ...s, blockShorts: e.target.checked }))}
            style={{ accentColor: C.pine, width: 16, height: 16 }}
          />
          Block Shorts (anything under 3 minutes)
        </label>
      </section>

      <section
        className="rounded-lg p-5 flex items-center justify-between"
        style={{ background: C.pineDeep }}
      >
        <div>
          <p style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: "#fff" }}>
            Ready to air?
          </p>
          <p className="text-xs mt-1" style={{ color: "#C9D6D1", fontFamily: BODY }}>
            {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""} · {channels.length}{" "}
            channel{channels.length !== 1 ? "s" : ""} · editions at {settings.refreshTimes.join(" and ")}
          </p>
        </div>
        <Btn kind="accent" onClick={() => refresh(true)} disabled={loading || !apiKey}>
          {loading ? "Programming…" : "Build first slate"}
        </Btn>
      </section>
    </div>
  );

  /* ---------- feed view ---------- */

  const GoalMeter = ({ goal }) => {
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
  };

  const VideoCard = ({ v }) => (
    <article
      className="rounded-lg overflow-hidden"
      style={{
        background: C.card,
        border: `1px solid ${C.mist}`,
        opacity: v.status === "fresh" ? 1 : 0.45,
      }}
    >
      {playing === v.id ? (
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${v.id}?autoplay=1`}
            title={v.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : (
        <button className="block w-full relative group" onClick={() => setPlaying(v.id)}>
          <img src={v.thumb} alt="" className="w-full block" />
          <span
            className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs"
            style={{ background: "rgba(28,40,38,0.9)", color: "#fff", fontFamily: MONO }}
          >
            {fmtDur(v.duration)}
          </span>
        </button>
      )}
      <div className="p-4">
        <h4
          className="leading-snug"
          style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: C.ink }}
        >
          {v.title}
        </h4>
        <p className="mt-1 text-xs" style={{ color: C.inkSoft, fontFamily: BODY }}>
          {v.channel}
        </p>
        <p className="mt-2 text-xs italic" style={{ color: C.pineDeep, fontFamily: BODY }}>
          {v.score}/100 — {v.why}
        </p>
        {v.status === "fresh" && (
          <div className="mt-3 flex gap-2">
            <Btn small onClick={() => (playing === v.id ? mark(v.id, "watched") : setPlaying(v.id))}>
              {playing === v.id ? "Mark watched" : "Watch"}
            </Btn>
            <Btn small kind="ghost" onClick={() => mark(v.id, "skipped")}>
              Skip
            </Btn>
          </div>
        )}
        {v.status !== "fresh" && (
          <p className="mt-3 text-xs" style={{ fontFamily: MONO, color: C.inkSoft }}>
            {v.status === "watched" ? "✓ watched" : "— skipped"}
          </p>
        )}
      </div>
    </article>
  );

  const SignOff = () => (
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

  const FeedView = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          {videos.length > 0 ? (
            <p style={{ fontFamily: BODY, fontSize: 14, color: C.inkSoft }}>
              Today's slate:{" "}
              <strong style={{ color: C.ink }}>
                {fresh.length} video{fresh.length !== 1 ? "s" : ""} · {fmtMins(totalSec)}
              </strong>{" "}
              remaining
              {done.length > 0 && ` · ${done.length} cleared`}
            </p>
          ) : (
            <p style={{ fontFamily: BODY, fontSize: 14, color: C.inkSoft }}>No slate yet.</p>
          )}
          {quotaUsed > 0 && (
            <p style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft }} className="mt-0.5">
              ~{quotaUsed} / 10,000 daily API units used
            </p>
          )}
        </div>
        <div className="text-right">
          <Btn onClick={() => refresh()} disabled={loading || !gate.allowed}>
            {loading ? "Programming…" : "New edition"}
          </Btn>
          {!gate.allowed && (
            <p className="mt-1" style={{ fontFamily: MONO, fontSize: 10, color: C.honeyDeep }}>
              unlocks {gate.next?.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: C.card, border: `1px solid ${C.mist}` }}
        >
          <p style={{ fontFamily: DISPLAY, fontSize: 18, color: C.ink }}>{loadStep}</p>
          <p className="mt-2 text-xs" style={{ color: C.inkSoft, fontFamily: BODY }}>
            Searching, filtering, and scoring takes ~30–60 seconds.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg p-4 mb-6 text-sm"
          style={{
            background: "#FBEFEA",
            border: `1px solid ${C.danger}`,
            color: C.danger,
            fontFamily: BODY,
          }}
        >
          {error}
        </div>
      )}

      {!loading && videos.length === 0 && !error && (
        <div
          className="rounded-lg p-12 text-center"
          style={{ background: C.card, border: `1px dashed ${C.mist}` }}
        >
          <p style={{ fontFamily: DISPLAY, fontSize: 22, color: C.ink }}>Nothing is scheduled.</p>
          <p className="mt-2 text-sm" style={{ color: C.inkSoft, fontFamily: BODY }}>
            Set your goals in Programming, then build your first slate.
          </p>
        </div>
      )}

      {!loading &&
        activeGoals.map((g) => {
          const goalVids = videos.filter((v) => v.goalId === g.id);
          if (!goalVids.length) return null;
          return (
            <section key={g.id} className="mb-10">
              <GoalMeter goal={g} />
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
              >
                {goalVids.map((v) => (
                  <VideoCard key={v.id} v={v} />
                ))}
              </div>
            </section>
          );
        })}

      {!loading && videos.length > 0 && fresh.length === 0 && <SignOff />}
    </div>
  );

  /* ---------- shell ---------- */

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      <div className="mx-auto px-6 py-8" style={{ maxWidth: 1100 }}>
        <Masthead />
        {view === "settings" ? <SettingsView /> : <FeedView />}
        <footer
          className="mt-16 pt-4 text-xs flex justify-between"
          style={{ borderTop: `1px solid ${C.mist}`, color: C.inkSoft, fontFamily: MONO }}
        >
          <span>Slate — the feed that ends</span>
          <span>prototype · settings reset on reload</span>
        </footer>
      </div>
    </div>
  );
}
