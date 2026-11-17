// THE CULTT store-window kiosk (iPad, landscape). Screens: welcome / attract (idle state) and a catalog placeholder.
// Routing by hash: "#/" (or empty) = welcome, "#/catalog" = catalog placeholder.
import { createButton } from "./design-system/components/button/button.js?v=64acbb7ea054";
import { idleTimeoutMs } from "./config.js?v=64acbb7ea054";
import { createIdleTimer } from "./idle.js?v=64acbb7ea054";
import { mountShowcase } from "./showcase.js?v=64acbb7ea054";
import { SHOWCASE_COLUMNS } from "./products.js?v=64acbb7ea054";

const ROUTES = { welcome: "#/", catalog: "#/catalog" };
const $ = (sel) => document.querySelector(sel);

// Transient browsing state of the current visitor. Lives in memory only (no storage), cleared on idle.
const createSession = () => ({ startedAt: null, selectedLots: new Set() });
let session = createSession();

const showcase = mountShowcase($("#showcase"), SHOWCASE_COLUMNS);

$("#welcomeCta").append(createButton({
  label: "Выбрать лоты",
  variant: "primary",
  width: "fill",
  iconPosition: "trailing",
  icon: "arrow-right",
  onClick: () => go("catalog"),
}));
$("#catalogBack").append(createButton({
  label: "На главную",
  variant: "secondary",
  iconPosition: "leading",
  icon: "arrow-left",
  onClick: () => returnToWelcome(), // a new visitor starts from scratch
}));

const idle = createIdleTimer({ timeoutMs: idleTimeoutMs(), onIdle: () => returnToWelcome() });

function resetSession() {
  session = createSession();
  for (const el of document.querySelectorAll("[data-scroll-reset]")) el.scrollTop = 0;
  document.activeElement?.blur?.();
}

function returnToWelcome() {
  resetSession();
  go("welcome", { replace: true });
}

function go(route, { replace = false } = {}) {
  const hash = ROUTES[route];
  if (location.hash === hash || (route === "welcome" && !location.hash)) return render();
  if (replace) history.replaceState(null, "", hash);
  else location.hash = hash;
  render();
}

function currentRoute() {
  return location.hash === ROUTES.catalog ? "catalog" : "welcome";
}

function render() {
  const route = currentRoute();
  document.documentElement.dataset.screen = route;
  for (const s of document.querySelectorAll("[data-screen-id]")) {
    const on = s.dataset.screenId === route;
    s.hidden = !on;
    s.inert = !on;
  }
  // The welcome screen is the idle state: showcase runs there, the idle timer runs everywhere else.
  showcase.setRunning(route === "welcome");
  if (route === "welcome") idle.stop();
  else {
    if (!session.startedAt) session.startedAt = Date.now();
    idle.start();
  }
}

addEventListener("hashchange", render);
addEventListener("pagehide", () => idle.stop());
render();

// Read-only hooks for automated checks (Playwright); no behaviour depends on them.
window.__kiosk = {
  get route() { return currentRoute(); },
  get idleActive() { return idle.active; },
  get idleTimeoutMs() { return idle.timeoutMs; },
  get session() { return { startedAt: session.startedAt, selectedLots: session.selectedLots.size }; },
};
