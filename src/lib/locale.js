const FALLBACK_LOCALE = "en-CA";

export function getBrowserLocale() {
  const locale = typeof navigator !== "undefined" ? navigator.language : "";
  return typeof locale === "string" && locale.trim() ? locale : FALLBACK_LOCALE;
}

function formatWithBrowserLocale(value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat(getBrowserLocale(), options).format(date);
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, options).format(date);
  }
}

export function formatDate(value, options) {
  return formatWithBrowserLocale(value, options);
}

export function formatTime(value, options) {
  return formatWithBrowserLocale(value, options);
}
