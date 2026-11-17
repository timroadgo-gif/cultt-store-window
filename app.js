// THE CULTT store-window kiosk (iPad, landscape).
// Screens by hash: "#/" (or empty) = welcome / attract (idle state), "#/catalog" = catalog, "#/product/<id>" = product
// page; the fitting tray and the fitting sheet are shared by both. After «Заказать на примерку» succeeds, the
// confirmation screen (request number, 10 s) covers everything and then returns to the welcome screen.
// Visitor state (catalog search / filters / sort, fitting selection) lives in memory only and is cleared when the idle timer returns the kiosk to the welcome screen.
import { createButton } from "./design-system/components/button/button.js?v=0edeae3118e6";
import { pill } from "./catalog/ui.js?v=0edeae3118e6";
import { idleTimeoutMs } from "./config.js?v=0edeae3118e6";
import { createIdleTimer } from "./idle.js?v=0edeae3118e6";
import { mountShowcase } from "./showcase.js?v=0edeae3118e6";
import { SHOWCASE_COLUMNS } from "./products.js?v=0edeae3118e6";
import { CATALOG_PRODUCTS } from "./catalog/products.js?v=0edeae3118e6";
import { createSelection } from "./catalog/selection.js?v=0edeae3118e6";
import { mountCatalog } from "./catalog/catalog-screen.js?v=0edeae3118e6";
import { submitFittingRequest } from "./catalog/request.js?v=0edeae3118e6";
import { createConfirmScreen } from "./catalog/confirm-screen.js?v=0edeae3118e6";
import { mountProduct } from "./catalog/product-screen.js?v=0edeae3118e6";

const ROUTES = { welcome: "#/", catalog: "#/catalog", product: "#/product/" };
const $ = (sel) => document.querySelector(sel);
const byId = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));

let startedAt = null;
const showcase = mountShowcase($("#showcase"), SHOWCASE_COLUMNS);

const selection = createSelection({ onChange: (change) => { catalog.onSelectionChange(change); product.onSelectionChange(change); } });
const catalog = mountCatalog($("#catalogScreen"), {
  products: CATALOG_PRODUCTS, selection,
  onSubmitFitting: (ids) => submitAndConfirm(ids),
  onOpenProduct: (id) => openProduct(id),
  onAddMore: () => { if (currentRoute() === "product") go("catalog"); },
});
const product = mountProduct($("#productScreen"), { byId, selection, onBack: () => go("catalog"), onOpenFitting: () => catalog.fittingSheet.open() });

// Catalog scroll position survives a visit to a product page (the catalog is hidden, not rebuilt).
let catalogScroll = 0;
function openProduct(id) {
  catalogScroll = catalog.scroller.scrollTop;
  location.hash = ROUTES.product + encodeURIComponent(id);
}
// Confirmation: shown only after the (mock) submission resolved. Once its entrance is done, the session is reset under
// the opaque layer (selection, catalog, overlays) and the welcome screen is set behind it; leaving just fades it out.
const confirm = createConfirmScreen({
  byId,
  onEntered: () => { resetSession(); go("welcome", { replace: true }); },
});
async function submitAndConfirm(ids) {
  const request = await submitFittingRequest(ids); // throws → the sheet restores its button
  confirm.show(request);
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

const idle = createIdleTimer({ timeoutMs: idleTimeoutMs(), onIdle: () => returnToWelcome() });

// Next visitor: clear the fitting selection, search, filters, sort, scroll and any open overlay.
function resetSession() {
  startedAt = null;
  selection.clear();
  product.reset();
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

function currentRoute() {
  if (location.hash === ROUTES.catalog) return "catalog";
  if (productIdFromHash()) return byId.has(productIdFromHash()) ? "product" : "catalog";
  return "welcome";
}

let lastRoute = null;
function render() {
  const route = currentRoute();
  if (productIdFromHash() && route === "catalog") history.replaceState(null, "", ROUTES.catalog);
  document.documentElement.dataset.screen = route;
  for (const s of document.querySelectorAll("[data-screen-id]")) {
    const on = s.dataset.screenId === route;
    s.hidden = !on;
    s.inert = !on;
  }
  if (route !== "catalog") catalog.closeOverlays();
  if (route !== "product") product.close({ immediate: true });
  if (route !== "catalog" && route !== "product") catalog.closeFittingSheet();
  if (route === "product") product.show(productIdFromHash());
  // One fitting tray, shown on the catalog and on the product page.
  if (route === "catalog" || route === "product") $(route === "catalog" ? "#catalogScreen" : "#productScreen").append(catalog.panel.el);
  if (route === "catalog" && lastRoute === "product") catalog.scroller.scrollTop = catalogScroll;
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
  get session() { return { startedAt, selectedLots: selection.size, selection: selection.ids }; },
  get product() { return product.state; },
  get confirm() { return confirm.state; },
  get catalog() { const s = catalog.state; return { query: s.query, category: s.category, sort: s.sort, brands: [...s.brands], conditions: [...s.conditions], priceMax: s.priceMax, scrollTop: catalog.scroller.scrollTop }; },
};
