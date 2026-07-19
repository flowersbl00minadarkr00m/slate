/* YouTube Data API helpers.
   NOTE: the production slate build runs server-side in api/build-slate.js;
   these client-side helpers remain for self-hosters experimenting without
   the serverless layer and are not called by the default App flow. */

import { parseISODuration } from "./format.js";

const YT = "https://www.googleapis.com/youtube/v3";

export async function ytFetch(path, params, apiKey) {
  const qs = new URLSearchParams({ ...params, key: apiKey }).toString();
  const res = await fetch(`${YT}/${path}?${qs}`);
  const data = await res.json();
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || res.status;
    throw new Error(`YouTube API: ${reason}`);
  }
  return data;
}

export async function searchVideos(query, apiKey, lookbackDays) {
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

export async function channelUploads(handleOrId, apiKey) {
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

export async function videoDetails(ids, apiKey) {
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
