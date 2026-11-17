// THE CULTT store-window kiosk (iPad, landscape).
// Screens by hash: "#/" (or empty) = welcome / attract (idle state), "#/catalog" = catalog (the fitting selection is a
// bottom sheet over it), "#/fitting-request" = placeholder for the step after «Заказать на примерку».
// Visitor state (catalog search / filters / sort, fitting selection) lives in memory only and is cleared when the idle timer returns the kiosk to the welcome screen.
import { createButton } from "./design-system/components/button/button.js?v=25bff0f871c8";
import { idleTimeoutMs } from "./config.js?v=25bff0f871c8";
import { createIdleTimer } from "./idle.js?v=25bff0f871c8";
import { mountShowcase } from "./showcase.js?v=25bff0f871c8";
import { SHOWCASE_COLUMNS } from "./products.js?v=25bff0f871c8";
import { CATALOG_PRODUCTS } from "./catalog/products.js?v=25bff0f871c8";
import { createSelection } from "./catalog/selection.js?v=25bff0f871c8";
import { mountCatalog } from "./catalog/catalog-screen.js?v=25bff0f871c8";
import { mountFitting } from "./catalog/fitting-screen.js?v=25bff0f871c8";

const ROUTES = { welcome: "#/", catalog: "#/catalog", fitting: "#/fitting-request" };
const $ = (sel) => document.querySelector(sel);
const byId = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));

let startedAt = null;
const showcase = mountShowcase($("#showcase"), SHOWCASE_COLUMNS);

const selection = createSelection({ onChange: (change) => catalog.onSelectionChange(change) });
const catalog = mountCatalog($("#catalogScreen"), { products: CATALOG_PRODUCTS, selection, onSubmitFitting: () => go("fitting") });
const fitting = mountFitting($("#fittingScreen"), { byId, selection, onBack: () => go("catalog") });

$("#welcomeCta").append(createButton({
  label: "Выбрать лоты",
  variant: "primary",
  width: "fill",
  iconPosition: "trailing",
  icon: "arrow-right",
  onClick: () => go("catalog"),
}));

const idle = createIdleTimer({ timeoutMs: idleTimeoutMs(), onIdle: () => returnToWelcome() });

// Next visitor: clear the fitting selection, search, filters, sort, scroll and any open overlay.
function resetSession() {
  startedAt = null;
  selection.clear();
  catalog.reset();
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
  if (location.hash === ROUTES.catalog) return "catalog";
  if (location.hash === ROUTES.fitting) return selection.size ? "fitting" : "catalog";
  return "welcome";
}

function render() {
  const route = currentRoute();
  if (location.hash === ROUTES.fitting && route === "catalog") history.replaceState(null, "", ROUTES.catalog);
  document.documentElement.dataset.screen = route;
  for (const s of document.querySelectorAll("[data-screen-id]")) {
    const on = s.dataset.screenId === route;
    s.hidden = !on;
    s.inert = !on;
  }
  if (route !== "catalog") catalog.closeOverlays();
  if (route === "fitting") fitting.render();
  // The welcome screen is the idle state: the showcase runs there, the idle timer runs everywhere else.
  showcase.setRunning(route === "welcome");
  if (route === "welcome") idle.stop();
  else {
    startedAt ??= Date.now();
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
  get session() { return { startedAt, selectedLots: selection.size, selection: selection.ids }; },
  get catalog() { const s = catalog.state; return { query: s.query, category: s.category, sort: s.sort, brands: [...s.brands], conditions: [...s.conditions], priceMax: s.priceMax, scrollTop: catalog.scroller.scrollTop }; },
};
