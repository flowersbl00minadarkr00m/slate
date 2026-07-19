/* Time, duration, and count formatting plus the edition-lock gate. */

export const uid = () => Math.random().toString(36).slice(2, 9);

export function parseISODuration(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || 0) * 3600 + parseInt(m[2] || 0) * 60 + parseInt(m[3] || 0);
}

export function fmtDur(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtMins(sec) {
  return `${Math.round(sec / 60)} min`;
}

export function fmtCount(n) {
  const value = Number(n || 0);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

export function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function nextUnlock(refreshTimes, lastRefresh) {
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
