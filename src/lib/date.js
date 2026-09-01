function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mondayOffset(dayOfWeek) {
  return (dayOfWeek + 6) % 7;
}

function localMidnight(date) {
  date.setHours(0, 0, 0, 0);
  return date;
}

function mondayOf(date) {
  const monday = localMidnight(new Date(date.getTime()));
  monday.setDate(monday.getDate() - mondayOffset(monday.getDay()));
  return monday;
}

function isoWeekNumber(start, isoYear) {
  const weekOne = localMidnight(new Date(isoYear, 0, 4));
  weekOne.setDate(weekOne.getDate() - mondayOffset(weekOne.getDay()));

  let week = 1;
  while (weekOne.getTime() < start.getTime()) {
    weekOne.setDate(weekOne.getDate() + 7);
    week += 1;
  }
  return week;
}

function formatDateRange(start, end) {
  const lastDay = new Date(end.getTime());
  lastDay.setDate(lastDay.getDate() - 1);
  const options = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-CA", options)}–${lastDay.toLocaleDateString("en-CA", options)}`;
}

export function getLocalISOWeek(value = new Date()) {
  const date = validDate(value);
  if (!date) return null;

  const start = mondayOf(date);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);

  const nearestThursday = new Date(start.getTime());
  nearestThursday.setDate(nearestThursday.getDate() + 3);
  const isoYear = nearestThursday.getFullYear();
  const isoWeek = isoWeekNumber(start, isoYear);
  const weekCode = String(isoWeek).padStart(2, "0");

  return {
    start,
    end,
    isoYear,
    isoWeek,
    label: `ISO ${isoYear}-W${weekCode} · ${formatDateRange(start, end)}`,
  };
}
