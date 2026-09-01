const INTERACTIVE_SELECTOR =
  "input, select, textarea, button, [contenteditable]:not([contenteditable='false'])";

export function isShortcutSuppressed(event) {
  const target = event?.target;
  const tagName = typeof target?.tagName === "string" ? target.tagName : "";
  const isInteractive =
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tagName) ||
    target?.isContentEditable ||
    target?.closest?.(INTERACTIVE_SELECTOR);

  return Boolean(
    event?.defaultPrevented ||
      event?.isComposing ||
      event?.keyCode === 229 ||
      event?.metaKey ||
      event?.ctrlKey ||
      event?.altKey ||
      event?.shiftKey ||
      isInteractive
  );
}

export function nextCardIndex(currentIndex, cardCount, step) {
  if (cardCount <= 0) return -1;
  if (currentIndex < 0) return step > 0 ? 0 : cardCount - 1;
  return Math.max(0, Math.min(cardCount - 1, currentIndex + step));
}
