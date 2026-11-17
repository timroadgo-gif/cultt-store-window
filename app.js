// THE CULTT store-window kiosk (iPad, landscape).
// Screens by hash: "#/" (or empty) = welcome / attract (idle state), "#/catalog" = catalog, "#/product/<id>" = product
// page; the fitting tray and the fitting sheet are shared by both. After «Заказать на примерку» succeeds, the
// confirmation screen (request number, 10 s) covers everything and then returns to the welcome screen.
// Visitor state (catalog search / filters / sort, fitting selection) lives in memory only; it is cleared by the
// inactivity warning (restart / timeout) and after a confirmed fitting request.
// Connectivity (catalog/network.js): one monitor for all screens. Without a connection everything local keeps working
// (catalog, filters, sort, product pages, the fitting selection and its sheet); only sending the fitting request is
// blocked. A compact notice (catalog/offline.js) is placed per screen; recovery is automatic and keeps all state.
import { createButton } from "./design-system/components/button/button.js?v=7a26db7e6a78";
import { pill } from "./catalog/ui.js?v=7a26db7e6a78";
import { idleTimeoutMs, warningSeconds } from "./config.js?v=7a26db7e6a78";
import { createIdleTimer } from "./idle.js?v=7a26db7e6a78";
import { mountShowcase } from "./showcase.js?v=7a26db7e6a78";
import { SHOWCASE_COLUMNS } from "./products.js?v=7a26db7e6a78";
import { CATALOG_PRODUCTS } from "./catalog/products.js?v=7a26db7e6a78";
import { createSelection } from "./catalog/selection.js?v=7a26db7e6a78";
import { mountCatalog } from "./catalog/catalog-screen.js?v=7a26db7e6a78";
import { OrderError, nextOrderFailure, setNextOrderFailure, submitFittingRequest } from "./catalog/request.js?v=7a26db7e6a78";
import { createNetwork } from "./catalog/network.js?v=7a26db7e6a78";
import { createOfflineBanner, watchImages } from "./catalog/offline.js?v=7a26db7e6a78";
import { createConfirmScreen } from "./catalog/confirm-screen.js?v=7a26db7e6a78";
import { createIdleWarning } from "./catalog/idle-warning.js?v=7a26db7e6a78";
import { mountProduct } from "./catalog/product-screen.js?v=7a26db7e6a78";
import { mountProductGallery } from "./catalog/product-gallery-screen.js?v=7a26db7e6a78";

const ROUTES = { welcome: "#/", catalog: "#/catalog", product: "#/product/", productX: "#/product-x/" };
const $ = (sel) => document.querySelector(sel);
const byId = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));

let startedAt = null;
const network = createNetwork();
const offlineBanner = createOfflineBanner(network);
const images = watchImages(network);
{ // simulator: ?net=offline | reconnecting opens the app in that state
  const sim = new URLSearchParams(location.search).get("net");
  if (sim) network.simulate(sim);
}
const showcase = mountShowcase($("#showcase"), SHOWCASE_COLUMNS);

const selection = createSelection({ onChange: (change) => { catalog.onSelectionChange(change); product.onSelectionChange(change); productX.onSelectionChange(change); } });
const catalog = mountCatalog($("#catalogScreen"), {
  products: CATALOG_PRODUCTS, selection, network,
  onSubmitFitting: (ids) => submitAndConfirm(ids),
  onOpenProduct: (id) => openProduct(id),
  onAddMore: () => { if (currentRoute() === "product") go("catalog"); },
});
const product = mountProduct($("#productScreen"), { byId, selection, onBack: () => go("catalog"), onOpenFitting: () => catalog.fittingSheet.open() });
// Product page: the gallery page (product-gallery-screen.js) is the main one since 2026-11-17; the previous page
// (product-screen.js) stays available through the simulator switch «Прежняя» (or ?pdp=classic). Same data, same selection.
const productX = mountProductGallery($("#productXScreen"), { byId, selection, onBack: () => go("catalog"), onOpenFitting: () => catalog.fittingSheet.open() });
let pdpVariant = new URLSearchParams(location.search).get("pdp") === "classic" ? "standard" : "gallery";

// Catalog scroll position survives a visit to a product page (the catalog is hidden, not rebuilt).
let catalogScroll = 0;
function openProduct(id) {
  catalogScroll = catalog.scroller.scrollTop;
  location.hash = (pdpVariant === "gallery" ? ROUTES.productX : ROUTES.product) + encodeURIComponent(id);
}
// Confirmation: shown only after the (mock) submission resolved. Once its entrance is done, the session is reset under
// the opaque layer (selection, catalog, overlays) and the welcome screen is set behind it; leaving just fades it out.
const confirm = createConfirmScreen({
  byId,
  onEntered: () => { resetSession(); go("welcome", { replace: true }); },
});
async function submitAndConfirm(ids) {
  try {
    const request = await submitFittingRequest(ids, { network });
    confirm.show(request);
  } catch (e) {
    // Only network failures go to the monitor (it re-checks; one failed call is not proof the device is offline).
    if (e instanceof OrderError && e.kind !== "server") network.reportFailure(e.kind);
    throw e; // the sheet explains it and keeps the selection
  }
}

const welcomeCta = createButton({
  label: "Выбрать лоты",
  variant: "primary",
  iconPosition: "trailing",
  icon: "arrow-right",
  onClick: () => go("catalog"),
});
pill(welcomeCta);
$("#welcomeCta").append(welcomeCta);

// One shared inactivity controller for the customer flow (catalog, product page, fitting sheet). Not on the welcome
// screen (it is the idle state) nor on the confirmation (own 10 s timer); the device picker is outside the app.
// IDLE_TIMEOUT_MS without activity → «Вы еще здесь?» with a WARNING_SECONDS countdown:
//   «Да, продолжить» → same screen and state, idle re-armed; «Начать заново» → clean session, catalog;
//   countdown at zero → clean session, welcome screen.
const idle = createIdleTimer({
  timeoutMs: idleTimeoutMs(),
  onIdle: () => { if (confirm.state.open) idle.start(); else warning.show(); },
});
const warning = createIdleWarning({
  seconds: warningSeconds(),
  inertTargets: () => [...document.body.children].filter((n) => n.tagName !== "SCRIPT"),
  onContinue: () => idle.start(),
  onRestart: () => { resetSession(); go("catalog", { replace: true }); },
  onTimeout: () => returnToWelcome(),
});

// Next visitor: clear the fitting selection, search, filters, sort, scroll and any open overlay.
function resetSession() {
  startedAt = null;
  if (warning.state.open) warning.dispose();
  selection.clear();
  product.reset();
  productX.reset();
  catalog.reset();
  catalogScroll = 0;
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

const productIdFromHash = () => (location.hash.startsWith(ROUTES.product) ? decodeURIComponent(location.hash.slice(ROUTES.product.length)) : null);
const productXIdFromHash = () => (location.hash.startsWith(ROUTES.productX) ? decodeURIComponent(location.hash.slice(ROUTES.productX.length)) : null);

function currentRoute() {
  if (location.hash === ROUTES.catalog) return "catalog";
  if (productXIdFromHash()) return byId.has(productXIdFromHash()) ? "productx" : "catalog";
  if (productIdFromHash()) return byId.has(productIdFromHash()) ? "product" : "catalog";
  return "welcome";
}

let lastRoute = null;
function render() {
  const route = currentRoute();
  if ((productIdFromHash() || productXIdFromHash()) && route === "catalog") history.replaceState(null, "", ROUTES.catalog);
  document.documentElement.dataset.screen = route;
  for (const s of document.querySelectorAll("[data-screen-id]")) {
    const on = s.dataset.screenId === route;
    s.hidden = !on;
    s.inert = !on;
  }
  if (route !== "catalog") catalog.closeOverlays();
  if (route !== "product") product.close({ immediate: true });
  if (route !== "productx") productX.close({ immediate: true });
  if (route !== "catalog" && route !== "product" && route !== "productx") catalog.closeFittingSheet();
  if (route === "product") product.show(productIdFromHash());
  if (route === "productx") productX.show(productXIdFromHash());
  // One fitting tray, shown on the catalog and on the product page.
  const trayHost = { catalog: "#catalogScreen", product: "#productScreen", productx: "#productXScreen" }[route];
  if (trayHost) $(trayHost).append(catalog.panel.el);
  // Offline notice: in the catalog flow under the header; floating top-right elsewhere (not on the confirmation).
  if (route === "catalog") offlineBanner.place(null, { placement: "inline", after: catalog.header });
  else offlineBanner.place($({ welcome: "#welcomeScreen", product: "#productScreen", productx: "#productXScreen" }[route] ?? "#welcomeScreen"));
  if (route === "catalog" && (lastRoute === "product" || lastRoute === "productx")) catalog.scroller.scrollTop = catalogScroll;
  lastRoute = route;
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
  get warning() { return warning.state; },
  get session() { return { startedAt, selectedLots: selection.size, selection: selection.ids }; },
  get product() { return product.state; },
  get productX() { return productX.state; },
  get pdpVariant() { return pdpVariant; },
  // Simulator control: switch the product page variant; an open product page switches in place.
  setPdpVariant(v) {
    pdpVariant = v === "gallery" ? "gallery" : "standard";
    const id = productIdFromHash() || productXIdFromHash();
    if (id && byId.has(id)) history.replaceState(null, "", (pdpVariant === "gallery" ? ROUTES.productX : ROUTES.product) + encodeURIComponent(id)), render();
    return pdpVariant;
  },
  get confirm() { return confirm.state; },
  get network() { return { ...network.state, canOrder: network.canOrder, failedImages: images.failed, nextOrderFailure: nextOrderFailure() }; },
  get fitting() { return catalog.fittingSheet.state; },
  get empty() { return catalog.empty; },
  // Automated checks only: same as applying the filters panel.
  applyFilters(f) { catalog.applyFilters(f); },
  // Simulator control (prototype testing only): "online" (= real connection) | "offline" | "reconnecting".
  setNetwork(mode) { return network.simulate(mode === "online" ? null : mode); },
  // Simulator control: make the next fitting request fail although the connection is fine ("server" | "timeout").
  setNextOrderFailure(kind) { return setNextOrderFailure(kind); },
  get catalog() { const s = catalog.state; return { query: s.query, category: s.category, sort: s.sort, types: [...s.types], brands: [...s.brands], models: [...s.models], colors: [...s.colors], conditions: [...s.conditions], priceMin: s.priceMin, priceMax: s.priceMax, scrollTop: catalog.scroller.scrollTop }; },
};
