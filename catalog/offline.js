// Offline presentation, shared by every screen:
//   • createOfflineBanner — one compact notice (white surface, hairline, small outline icon, Manrope 500 / 400).
//     app.js places it per screen: inline under the catalog header (it pushes the content down, never covers the
//     toolbar, filters or cards), floating top-right on the product pages and the welcome screen.
//   • watchImages — photos that failed to load (no connection, not cached yet) show a calm placeholder instead of
//     a broken image, and are reloaded automatically when the connection is back.
// Icon: Phosphor «wifi-slash», weight light (MIT, assets/LICENSE-phosphor.txt) — the family of the catalog's filter
// and sort icons. Inlined so it is available without a connection.
const WIFI_SLASH = '<svg viewBox="0 0 256 256" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M138,204a10,10,0,1,1-10-10A10,10,0,0,1,138,204ZM52.44,36A6,6,0,0,0,43.56,44L61.33,63.58a169.41,169.41,0,0,0-41.14,25,6,6,0,1,0,7.62,9.27A157.58,157.58,0,0,1,69.91,73l26.48,29.13a122.21,122.21,0,0,0-44.12,22.19,6,6,0,0,0,7.46,9.41,110,110,0,0,1,45.87-21.47l31.13,34.25A74.4,74.4,0,0,0,128,146a73.44,73.44,0,0,0-43.53,14.15A6,6,0,0,0,88,171a5.93,5.93,0,0,0,3.53-1.15,62,62,0,0,1,59.76-7.31L203.56,220a6,6,0,0,0,8.88-8.08ZM235.81,88.55A170.32,170.32,0,0,0,128,50a173.45,173.45,0,0,0-21.76,1.38,6,6,0,1,0,1.52,11.9A160.58,160.58,0,0,1,128,62,158.26,158.26,0,0,1,228.19,97.82a6,6,0,1,0,7.62-9.27Zm-39.54,45.2A6,6,0,0,0,200,135a6,6,0,0,0,3.73-10.7,122.26,122.26,0,0,0-50.9-23.81,6,6,0,1,0-2.43,11.75A110,110,0,0,1,196.27,133.75Z"/></svg>';
export const offlineIcon = (size = 20) => WIFI_SLASH.replace(/width="20" height="20"/, `width="${size}" height="${size}"`);

export const OFFLINE_COPY = {
  device: { title: "Нет подключения к интернету", body: "Вы можете продолжить просмотр. Заказать примерку получится после восстановления соединения." },
  service: { title: "Сервис примерки временно недоступен", body: "Вы можете продолжить просмотр. Заказать примерку получится, как только связь восстановится." },
};

const h = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

export function createOfflineBanner(network) {
  const el = h("div", "knet");
  el.dataset.state = "hidden";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const card = h("div", "knet__card");
  const icon = h("span", "knet__icon");
  icon.innerHTML = offlineIcon(20);
  const title = h("p", "knet__title");
  const body = h("p", "knet__body");
  const text = h("div", "knet__text");
  text.append(title, body);
  const status = h("span", "knet__status");
  status.append(h("span", "knet__spinner"), h("span", "knet__status-label", "Подключаемся…"));
  status.setAttribute("aria-hidden", "true"); // the live region announces the notice itself, not every retry
  card.append(icon, text, status);
  const clip = h("div", "knet__clip");
  clip.append(card);
  el.append(clip);

  network.subscribe((s) => {
    if (s.shown) {
      const copy = OFFLINE_COPY[s.reason ?? "device"];
      if (title.textContent !== copy.title) { title.textContent = copy.title; body.textContent = copy.body; }
    }
    el.dataset.state = s.shown ? "shown" : "hidden";
    el.toggleAttribute("data-checking", s.shown && s.checking);
  });

  // "inline" (catalog: in the page flow) | "float" (product pages, welcome: over the photos, top right).
  function place(parent, { placement = "float", after = null } = {}) {
    el.dataset.placement = placement;
    if (after) after.after(el);
    else if (el.parentNode !== parent) parent.append(el);
  }
  return { el, place };
}

// ---------- Photos without a connection ----------
const SMALL_MEDIA = 140; // below this width the placeholder is icon-only (thumbnails)

export function watchImages(network, root = document) {
  const failed = new Set();
  function mark(img) {
    const media = img.parentElement;
    if (!media || img.closest(".pswp")) return; // the fullscreen viewer has its own error state
    failed.add(img);
    img.dataset.unavailable = "";
    if (media.querySelector(":scope > .kimg-off")) return;
    const off = h("span", "kimg-off");
    off.setAttribute("aria-hidden", "true");
    off.innerHTML = offlineIcon(media.clientWidth < SMALL_MEDIA ? 16 : 20);
    if (media.clientWidth >= SMALL_MEDIA) off.append(h("span", "kimg-off__text", "Фото загрузится, когда вернется связь"));
    if (getComputedStyle(media).position === "static") media.classList.add("kimg-host");
    media.append(off);
  }
  function restore(img) {
    failed.delete(img);
    delete img.dataset.unavailable;
    img.parentElement?.querySelector(":scope > .kimg-off")?.remove();
  }
  root.addEventListener("error", (e) => { if (e.target instanceof HTMLImageElement && e.target.getAttribute("src")) mark(e.target); }, true);
  root.addEventListener("load", (e) => { if (e.target instanceof HTMLImageElement && failed.has(e.target)) restore(e.target); }, true);
  // Connection back → reload exactly the photos that failed (no page reload).
  let wasOnline = network.state.online;
  network.subscribe((s) => {
    if (s.online && !wasOnline) for (const img of [...failed]) {
      if (!img.isConnected) { failed.delete(img); continue; }
      const src = img.getAttribute("src");
      img.loading = "eager"; // also the ones scrolled out of view, so no placeholder is left behind
      img.removeAttribute("src");
      img.src = src;
    }
    wasOnline = s.online;
  });
  return { get failed() { return failed.size; } };
}
