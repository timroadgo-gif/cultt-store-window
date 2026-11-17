// Store-window kiosk settings. One place to tune the prototype.

// Inactivity (catalog, product page, fitting sheet) before the «Вы еще здесь?» warning appears: 60 s.
// For testing, the URL parameter ?idle=<ms> overrides it (e.g. ?idle=5000), never below 1 s.
export const IDLE_TIMEOUT_MS = 60_000;

// The warning's countdown; at zero the session is reset and the kiosk returns to the welcome screen.
// For testing, ?warn=<seconds> overrides it (3–60).
export const WARNING_SECONDS = 15;

// Showcase drift speed in CSS px per second; both columns use the same speed in opposite directions.
export const SHOWCASE_SPEED_PX_S = 14;

export function idleTimeoutMs(search = location.search) {
  const v = Number(new URLSearchParams(search).get("idle"));
  return Number.isFinite(v) && v >= 1000 ? v : IDLE_TIMEOUT_MS;
}

export function warningSeconds(search = location.search) {
  const v = Number(new URLSearchParams(search).get("warn"));
  return Number.isFinite(v) && v >= 3 && v <= 60 ? Math.round(v) : WARNING_SECONDS;
}
