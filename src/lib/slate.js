/* Relevance scoring (via serverless proxy) and the slate builder —
   the anti-doomscroll core. The OpenAI call happens server-side in
   /api/score so the API key never reaches the browser. */

export async function scoreBatch(videos, goals) {
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

export async function scoreAll(videos, goals) {
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

export function buildSlate(scored, goals, settings) {
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
