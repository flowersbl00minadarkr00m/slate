/*
  /api/score  — server-side relevance scoring
  Receives { videos, goals }, builds the scoring prompt, calls the
  Anthropic API with a key that lives only on the server, and returns
  a parsed array: [{ i, g, s, w }].
*/

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
    return;
  }

  // Vercel parses JSON bodies automatically, but guard for safety.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { videos = [], goals = [] } = body || {};
  if (!videos.length || !goals.length) {
    res.status(400).json({ error: "Send { videos, goals }." });
    return;
  }

  const goalList = goals
    .map((g) => `- id "${g.id}": ${g.name} — ${g.description}`)
    .join("\n");
  const vidList = videos
    .map((v, i) => `${i}. "${v.title}" | ${v.channel} | ${(v.description || "").slice(0, 140)}`)
    .join("\n");

  const prompt = `You score YouTube videos against a person's stated goals. Goals:
${goalList}

Videos:
${vidList}

For each video, pick the single best-matching goal and a relevance score 0-100 (0 = unrelated, 100 = exactly what this goal is for). Penalize clickbait, drama, and surface-level hype; reward depth and practitioner value. Respond ONLY with a JSON array, no markdown fences, no prose: [{"i":0,"g":"<goal id>","s":85,"w":"<reason, max 8 words>"}]`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.SLATE_MODEL || DEFAULT_MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: data?.error?.message || "Anthropic API error." });
      return;
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    let scored = [];
    try {
      scored = JSON.parse(text);
    } catch {
      scored = [];
    }

    res.status(200).json({ scored });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
