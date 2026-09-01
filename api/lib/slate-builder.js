const MIN_SCORE = 50;

export function buildSlate(scored, goals, settings) {
  const eligible = scored.filter((video) => video.score >= MIN_SCORE);
  const slate = [];

  for (const goal of goals) {
    let budget = Math.round((goal.weeklyMinutes / 7) * 60);
    const candidates = eligible
      .filter((video) => video.goalId === goal.id)
      .sort((a, b) => b.score - a.score);

    for (const video of candidates) {
      if (budget <= 0) break;
      slate.push({ ...video, status: "fresh" });
      budget -= video.duration;
    }
  }

  return slate.sort((a, b) => b.score - a.score).slice(0, settings.feedCap);
}
