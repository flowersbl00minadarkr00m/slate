/*
  /api/score — server-side relevance scoring
  Receives { videos, goals }, builds the scoring prompt, calls the
  OpenAI Responses API with a key that lives only on the server, and
  returns [{ i, g, s, w }].
*/

const DEFAULT_MODEL = "gpt-5.5";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not set on the server." });
    return;
  }

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

  const prompt = `Score every YouTube video against the stated learning goals.

Goals:
${goalList}

Videos:
${vidList}

For each video, choose the single best-matching goal and assign a relevance score from 0 to 100. Penalize clickbait, drama, weak historical grounding, and surface-level summaries. Reward depth, credible context, edge cases, competing interpretations, and practitioner value. Keep each reason to eight words or fewer.`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.SLATE_MODEL || DEFAULT_MODEL,
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
    if (!r.ok) {
      res.status(r.status).json({ error: data?.error?.message || "OpenAI API error." });
      return;
    }

    const content = (data.output || []).flatMap((item) => item.content || []);
    const refusal = content.find((item) => item.type === "refusal");
    if (refusal) {
      res.status(422).json({ error: refusal.refusal || "Scoring request was refused." });
      return;
    }

    const outputText = content.find((item) => item.type === "output_text")?.text || "";
    const parsed = JSON.parse(outputText);
    res.status(200).json({ scored: parsed.scores || [] });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
