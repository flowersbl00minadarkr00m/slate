/*
  /api/build-slate — server-side Slate builder

  The browser sends goals/settings only. This function keeps API keys on
  the server, pulls YouTube candidates, reuses Supabase cache where possible,
  scores missing candidates with OpenAI, blends relevance with popularity, and
  stores useful video suggestions for later analysis/shared-brain workflows.
*/

import crypto from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";
import { getDatabaseConfig } from "./lib/database-config.js";
import { createRateLimiter, getClientKey, getHeader, isAllowedOrigin } from "./lib/request-policy.js";
import { RequestValidationError, normalizeRequestBody } from "./lib/request-validation.js";
import { buildSlate } from "./lib/slate-builder.js";

const YT = "https://www.googleapis.com/youtube/v3";
const DEFAULT_MODEL = "gpt-5.5";
const SCORE_MODEL = process.env.SLATE_MODEL || DEFAULT_MODEL;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
let schemaReady = false;
let pgPool = null;
let lastCacheError = "";

const scoreSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer", minimum: 0 },
          g: { type: "string" },
          s: { type: "integer", minimum: 0, maximum: 100 },
          w: { type: "string" },
        },
        required: ["i", "g", "s", "w"],
        additionalProperties: false,
      },
    },
  },
  required: ["scores"],
  additionalProperties: false,
};

function parseISODuration(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || 0) * 3600 + parseInt(m[2] || 0) * 60 + parseInt(m[3] || 0);
}

function hashGoal(goal) {
  return crypto
    .createHash("sha256")
    .update(`${goal.id}|${goal.name}|${goal.description}`.toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

function intStat(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function popularityScore(video) {
  const views = intStat(video.viewCount);
  const comments = intStat(video.commentCount);
  const likes = intStat(video.likeCount);
  const viewScore = clamp((Math.log10(views + 1) / 6) * 100);
  const engagementScore = views > 0 ? clamp(((likes + comments * 4) / views) * 5000) : 0;
  return Math.round(viewScore * 0.8 + engagementScore * 0.2);
}

function freshnessScore(video) {
  if (!video.published) return 50;
  const ageDays = (Date.now() - new Date(video.published).getTime()) / 86400000;
  return clamp(100 - ageDays / 3);
}

function finalScore(video) {
  const relevance = clamp(video.relevanceScore ?? video.score ?? 0);
  const popularity = popularityScore(video);
  const freshness = freshnessScore(video);
  const blended = relevance * 0.72 + popularity * 0.2 + freshness * 0.08;
  return Math.round(clamp(blended));
}

function normalizeVideo(row) {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    description: row.description || "",
    thumb: row.thumb,
    published: row.published_at || row.published,
    duration: row.duration_seconds ?? row.duration,
    viewCount: intStat(row.view_count ?? row.viewCount),
    likeCount: intStat(row.like_count ?? row.likeCount),
    commentCount: intStat(row.comment_count ?? row.commentCount),
    url: row.url || `https://www.youtube.com/watch?v=${row.id}`,
  };
}

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
      { part: "snippet,contentDetails,statistics", id: batch.join(",") },
      apiKey
    );
    for (const v of data.items || []) {
      out.push({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        description: (v.snippet.description || "").slice(0, 500),
        thumb: v.snippet.thumbnails?.medium?.url,
        published: v.snippet.publishedAt,
        duration: parseISODuration(v.contentDetails.duration),
        viewCount: intStat(v.statistics?.viewCount),
        likeCount: intStat(v.statistics?.likeCount),
        commentCount: intStat(v.statistics?.commentCount),
        url: `https://www.youtube.com/watch?v=${v.id}`,
      });
    }
  }
  return out;
}

function postgresConnectionString() {
  return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "";
}

function getPool() {
  const rawConnectionString = postgresConnectionString();
  if (!rawConnectionString) return null;
  let config;
  try {
    config = getDatabaseConfig(rawConnectionString);
  } catch {
    lastCacheError = "cache-unavailable";
    return null;
  }
  if (!config) return null;
  if (!pgPool) {
    pgPool = new pg.Pool(config);
  }
  return pgPool;
}

async function ensureSupabaseSchema() {
  if (schemaReady) return true;
  const pool = getPool();
  if (!pool) return false;

  try {
    const schemaPath = new URL("../supabase/slate-cache.sql", import.meta.url);
    const sql = await fs.readFile(schemaPath, "utf8");
    await pool.query(sql);
    schemaReady = true;
    return true;
  } catch {
    lastCacheError = "cache-unavailable";
    console.warn("Slate cache unavailable", { code: "cache-unavailable" });
    return false;
  }
}

async function getCachedVideos(ids) {
  const pool = getPool();
  if (!ids.length) return { videos: [], hitIds: new Set(), available: Boolean(pool) };
  if (!pool || !(await ensureSupabaseSchema())) return { videos: [], hitIds: new Set(), available: false };
  const result = await pool.query("select * from public.slate_video_cache where id = any($1::text[])", [ids]);
  const freshRows = result.rows.filter(
    (row) => Date.now() - new Date(row.fetched_at || 0).getTime() < CACHE_TTL_MS
  );
  return {
    videos: freshRows.map(normalizeVideo),
    hitIds: new Set(freshRows.map((v) => v.id)),
    available: true,
  };
}

async function cacheVideos(videos) {
  const pool = getPool();
  if (!videos.length || !pool || !(await ensureSupabaseSchema())) return false;
  await Promise.all(
    videos.map((v) =>
      pool.query(
        `insert into public.slate_video_cache
          (id, url, title, channel, description, thumb, published_at, duration_seconds, view_count, like_count, comment_count, fetched_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         on conflict (id) do update set
          url = excluded.url,
          title = excluded.title,
          channel = excluded.channel,
          description = excluded.description,
          thumb = excluded.thumb,
          published_at = excluded.published_at,
          duration_seconds = excluded.duration_seconds,
          view_count = excluded.view_count,
          like_count = excluded.like_count,
          comment_count = excluded.comment_count,
          fetched_at = now()`,
        [
          v.id,
          v.url,
          v.title,
          v.channel,
          v.description,
          v.thumb,
          v.published,
          v.duration,
          v.viewCount,
          v.likeCount,
          v.commentCount,
        ]
      )
    )
  );
  return true;
}

async function getCachedScores(videos, goals) {
  const pool = getPool();
  const fingerprints = goals.map(hashGoal);
  if (!videos.length || !fingerprints.length) return { scores: [], available: Boolean(pool) };
  if (!pool || !(await ensureSupabaseSchema())) return { scores: [], available: false };
  const result = await pool.query(
    `select * from public.slate_score_cache
     where video_id = any($1::text[])
       and goal_fingerprint = any($2::text[])
       and model = $3`,
    [videos.map((v) => v.id), fingerprints, SCORE_MODEL]
  );
  return { scores: result.rows || [], available: true };
}

async function getCachedScoredCandidates(goals, limit = 24) {
  const pool = getPool();
  const fingerprints = goals.map(hashGoal);
  if (!pool || !fingerprints.length || !(await ensureSupabaseSchema())) {
    return { scored: [], available: false };
  }
  const result = await pool.query(
    `select
       vc.*,
       sc.goal_id,
       sc.relevance_score,
       sc.final_score,
       sc.why
     from public.slate_score_cache sc
     join public.slate_video_cache vc on vc.id = sc.video_id
     where sc.goal_fingerprint = any($1::text[])
       and sc.model = $2
     order by sc.final_score desc, vc.view_count desc, sc.scored_at desc
     limit $3`,
    [fingerprints, SCORE_MODEL, limit]
  );
  return {
    available: true,
    scored: result.rows.map((row) => ({
      ...normalizeVideo(row),
      goalId: row.goal_id,
      relevanceScore: row.relevance_score,
      score: row.final_score,
      why: row.why,
      cache: "score",
    })),
  };
}

async function cacheScores(rows) {
  const pool = getPool();
  if (!rows.length || !pool || !(await ensureSupabaseSchema())) return false;
  await Promise.all(
    rows.map((row) =>
      pool.query(
        `insert into public.slate_score_cache
          (video_id, goal_id, goal_fingerprint, goal_name, relevance_score, final_score, why, model, scored_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now())
         on conflict (video_id, goal_fingerprint, model) do update set
          goal_id = excluded.goal_id,
          goal_name = excluded.goal_name,
          relevance_score = excluded.relevance_score,
          final_score = excluded.final_score,
          why = excluded.why,
          scored_at = now()`,
        [
          row.video_id,
          row.goal_id,
          row.goal_fingerprint,
          row.goal_name,
          row.relevance_score,
          row.final_score,
          row.why,
          row.model,
        ]
      )
    )
  );
  return true;
}

async function scoreBatch(videos, goals, openaiKey) {
  const goalList = goals
    .map((g) => `- id "${g.id}": ${g.name} — ${g.description}`)
    .join("\n");
  const vidList = videos
    .map(
      (v, i) =>
        `${i}. "${v.title}" | ${v.channel} | views ${v.viewCount || 0} | ${(v.description || "").slice(0, 180)}`
    )
    .join("\n");

  const prompt = `Score every YouTube video against the stated learning goals.

Goals:
${goalList}

Videos:
${vidList}

For each video, choose the single best-matching goal and assign a relevance score from 0 to 100. Penalize clickbait, shallow summaries, drama, and weak grounding. Reward depth, credible context, practical edge cases, competing interpretations, and durable learning value. Popularity is shown for context only; judge intellectual fit first. Keep each reason to eight words or fewer.`;

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: SCORE_MODEL,
      reasoning: { effort: "none" },
      input: prompt,
      max_output_tokens: 2000,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "video_scores",
          strict: true,
          schema: scoreSchema,
        },
      },
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI API error.");
  const content = (data.output || []).flatMap((item) => item.content || []);
  const refusal = content.find((item) => item.type === "refusal");
  if (refusal) throw new Error(refusal.refusal || "Scoring request was refused.");
  const outputText = content.find((item) => item.type === "output_text")?.text || "";
  return JSON.parse(outputText).scores || [];
}

async function scoreAll(videos, goals, openaiKey) {
  const cached = await getCachedScores(videos, goals);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const cachedByVideo = new Map();
  for (const row of cached.scores) {
    cachedByVideo.set(row.video_id, row);
  }

  const scored = [];
  const missing = [];
  let scoreHits = 0;
  for (const video of videos) {
    const row = cachedByVideo.get(video.id);
    const goal = row ? goalById.get(row.goal_id) : null;
    if (row && goal) {
      const enriched = {
        ...video,
        goalId: row.goal_id,
        relevanceScore: row.relevance_score,
        score: 0,
        why: row.why,
        cache: "score",
      };
      enriched.score = finalScore(enriched);
      scored.push(enriched);
      scoreHits += 1;
    } else {
      missing.push(video);
    }
  }

  const scoreRows = [];
  const CHUNK = 10;
  const chunks = [];
  for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
  const chunkResults = await Promise.all(chunks.map((chunk) => scoreBatch(chunk, goals, openaiKey)));
  for (let c = 0; c < chunks.length; c += 1) {
    const chunk = chunks[c];
    const results = chunkResults[c];
    for (const result of results) {
      const video = chunk[result.i];
      const goal = goalById.get(result.g);
      if (!video || !goal) continue;
      const enriched = {
        ...video,
        goalId: result.g,
        relevanceScore: result.s,
        score: 0,
        why: result.w,
        cache: "fresh-score",
      };
      enriched.score = finalScore(enriched);
      scored.push(enriched);
      scoreRows.push({
        video_id: video.id,
        goal_id: goal.id,
        goal_fingerprint: hashGoal(goal),
        goal_name: goal.name,
        relevance_score: result.s,
        final_score: enriched.score,
        why: result.w,
        model: SCORE_MODEL,
        scored_at: new Date().toISOString(),
      });
    }
  }
  await cacheScores(scoreRows);
  return {
    scored,
    cacheAvailable: cached.available,
    scoreHits,
    scoreMisses: missing.length,
  };
}

async function saveRun({ goals, channels, settings, slate, quotaUsed, cacheStats }) {
  const rows = [
    {
      goals,
      channels,
      settings,
      videos: slate.map((v) => ({
        id: v.id,
        url: v.url,
        title: v.title,
        channel: v.channel,
        goalId: v.goalId,
        score: v.score,
        relevanceScore: v.relevanceScore,
        viewCount: v.viewCount,
        why: v.why,
      })),
      quota_used: quotaUsed,
      cache_stats: cacheStats,
    },
  ];
  const pool = getPool();
  if (!pool || !(await ensureSupabaseSchema())) return false;
  await pool.query(
    `insert into public.slate_runs (goals, channels, settings, videos, quota_used, cache_stats)
     values ($1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6::jsonb)`,
    [
      JSON.stringify(rows[0].goals),
      JSON.stringify(rows[0].channels),
      JSON.stringify(rows[0].settings),
      JSON.stringify(rows[0].videos),
      rows[0].quota_used,
      JSON.stringify(rows[0].cache_stats),
    ]
  );
  return true;
}

async function buildSlateRequest(body) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!openaiKey || !youtubeKey) throw new Error("Provider configuration incomplete.");

  const { goals, channels, settings } = body;
  await ensureSupabaseSchema();

  let quotaUsed = 0;
  const queryJobs = [];
  for (const goal of goals) {
    const queries = String(goal.keywords || goal.name)
      .split(",")
      .map((query) => query.trim())
      .filter(Boolean)
      .slice(0, 2);
    for (const query of queries) {
      queryJobs.push(searchVideos(query, youtubeKey, settings.lookbackDays));
    }
  }

  const querySettled = await Promise.allSettled(queryJobs);
  quotaUsed += queryJobs.length * 100;
  const ids = new Set();
  const queryErrors = [];
  for (const result of querySettled) {
    if (result.status === "fulfilled") {
      result.value.forEach((id) => ids.add(id));
    } else {
      queryErrors.push(result.reason?.message || String(result.reason));
    }
  }

  if (!ids.size && queryErrors.length) {
    const fallback = await getCachedScoredCandidates(goals, settings.feedCap * 3);
    if (fallback.scored.length) {
      const slate = buildSlate(fallback.scored, goals, settings);
      const cacheStats = {
        postgresConfigured: Boolean(postgresConnectionString()),
        supabaseAvailable: fallback.available,
        cacheError: "",
        fallback: "youtube-search-failed",
        videoHits: fallback.scored.length,
        videoMisses: 0,
        scoreHits: fallback.scored.length,
        scoreMisses: 0,
      };
      await saveRun({ goals, channels, settings, slate, quotaUsed, cacheStats });
      return { videos: slate, quotaUsed, cacheStats, model: SCORE_MODEL };
    }
    throw new Error(queryErrors[0]);
  }

  if (channels.length) {
    const channelResults = await Promise.allSettled(
      channels.map((channel) => channelUploads(channel, youtubeKey))
    );
    for (const result of channelResults) {
      if (result.status === "fulfilled") {
        result.value.forEach((id) => ids.add(id));
        quotaUsed += 2;
      }
    }
  }

  const allIds = [...ids];
  const cachedVideos = await getCachedVideos(allIds);
  const missingIds = allIds.filter((id) => !cachedVideos.hitIds.has(id));
  const fetchedVideos = await videoDetails(missingIds, youtubeKey);
  quotaUsed += Math.ceil(missingIds.length / 50);
  await cacheVideos(fetchedVideos);

  const minSec = settings.minLengthMin * 60;
  const filteredCandidates = [...cachedVideos.videos, ...fetchedVideos].filter((video) => {
    if (settings.blockShorts && video.duration < 180) return false;
    return video.duration >= minSec;
  });
  const maxCandidates = Math.min(60, Math.max(settings.feedCap * 6, 36));
  const candidates = filteredCandidates
    .sort(
      (a, b) =>
        popularityScore(b) * 0.7 +
        freshnessScore(b) * 0.3 -
        (popularityScore(a) * 0.7 + freshnessScore(a) * 0.3)
    )
    .slice(0, maxCandidates);

  const scoredResult = await scoreAll(candidates, goals, openaiKey);
  const slate = buildSlate(scoredResult.scored, goals, settings);
  const cacheStats = {
    postgresConfigured: Boolean(postgresConnectionString()),
    supabaseAvailable: cachedVideos.available && scoredResult.cacheAvailable,
    cacheError: lastCacheError ? "cache-unavailable" : "",
    videoHits: cachedVideos.videos.length,
    videoMisses: fetchedVideos.length,
    scoreHits: scoredResult.scoreHits,
    scoreMisses: scoredResult.scoreMisses,
  };

  await saveRun({ goals, channels, settings, slate, quotaUsed, cacheStats });

  return {
    videos: slate,
    quotaUsed,
    cacheStats,
    model: SCORE_MODEL,
  };
}

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendError(res, status, code, error, requestId) {
  const body = { error, code };
  if (requestId) body.requestId = requestId;
  res.status(status).json(body);
}

export function createBuildSlateHandler({
  env = process.env,
  builder = buildSlateRequest,
  limiter = createRateLimiter(),
  requestId = () => `req_${crypto.randomUUID()}`,
} = {}) {
  return async function handler(req, res) {
    setSecurityHeaders(res);

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendError(res, 405, "method-not-allowed", "Method not allowed.");
      return;
    }

    if (getHeader(req, "content-type").split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      sendError(res, 415, "unsupported-media-type", "JSON is required.");
      return;
    }

    if (!isAllowedOrigin(req, env.SLATE_ALLOWED_ORIGINS || "")) {
      sendError(res, 403, "origin-not-allowed", "Origin is not allowed.");
      return;
    }

    if (env.SLATE_API_ENABLED !== "1") {
      sendError(res, 503, "generation-disabled", "Slate generation is not enabled.");
      return;
    }

    const rate = limiter.check(getClientKey(req));
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      sendError(res, 429, "rate-limited", "Too many requests. Try again later.");
      return;
    }

    let body;
    try {
      body = normalizeRequestBody(req.body);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        sendError(res, 400, error.code, error.message);
        return;
      }
      throw error;
    }

    if (!env.OPENAI_API_KEY || !env.YOUTUBE_API_KEY) {
      sendError(res, 503, "provider-not-configured", "Slate generation is not configured.");
      return;
    }

    try {
      res.status(200).json(await builder(body));
    } catch {
      const id = requestId();
      console.error("Slate generation failed", { requestId: id, code: "internal-error" });
      sendError(res, 500, "internal-error", "Slate generation failed.", id);
    }
  };
}

export default createBuildSlateHandler();
