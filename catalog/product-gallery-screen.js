// Карточка товара (основная с 2026-11-17) — «галерея» по образцу страницы товара Hermès, айдентика THE CULTT.
// Маршрут #/product-x/<id>; открывается из каталога для всех лотов — единственная карточка товара.
//   • Фото во всю высоту экрана, 3:4 (ширина = высота × 3/4), идут лентой вправо с зазором 4 px и уходят за край.
//     Прокрутка свободная: нативная инерция, без scroll-snap и без доводки — где палец отпустил, там лента и стоит.
//   • Внизу слева — лента миниатюр (как у Hermès): полупрозрачные, активная — непрозрачная с тонкой чертой снизу;
//     активная = фото, которое больше всех видно на экране; тап по миниатюре плавно прокручивает ленту к фото.
//   • Тап по фото — общий полноэкранный просмотр (fullscreen.js); после закрытия лента показывает просмотренное фото.
//   • Справа внизу — белая панель поверх фото: состояние · «Бренд Модель» · цена · «Добавить в примерку» /
//     «Убрать из примерки» (всегда видны) · аккордеоны «Информация о лоте» и «Размеры» (прокручиваются отдельно).
//     Панель растет вверх, нижний край закреплен над панелью примерки.
//   • Назад — стеклянная кнопка UI Kit (GlassIconButton) слева вверху.
//   • Два состояния галереи: A — примерка пуста, фото во всю высоту; B — есть лоты в примерке (видна панель примерки),
//     галерея заканчивается у верхнего края панели (перекрытие 8 px), фото уменьшаются с сохранением 3:4. Переход
//     анимирован (360 мс, как выезд панели; без анимации при reduced motion), позиция прокрутки сохраняется.
// Выбор на примерку — общий selection (каталог, панель примерки, шторка).
import { createButton } from "../design-system/components/button/button.js?v=431dfa42b9fe";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=431dfa42b9fe";
import { createIconButton } from "../design-system/components/icon-button/icon-button.js?v=431dfa42b9fe";
import { createIcon } from "../design-system/icons/icon.js?v=431dfa42b9fe";
import { money } from "./filters.js?v=431dfa42b9fe";
import { pill } from "./ui.js?v=431dfa42b9fe";
import { openFullscreen } from "./fullscreen.js?v=431dfa42b9fe";
import { lotDetails } from "./lot-details.js?v=431dfa42b9fe";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

export function mountProductGallery(root, { byId, selection, onBack, onOpenFitting }) {
  let product = null;
  let index = 0; // the photo most visible on screen (= active thumbnail)
  let pswp = null;
  let raf = 0;

  // ---------- Gallery ----------
  const track = h("div", "kpx-track");
  track.setAttribute("aria-label", "Фотографии лота, листаются вправо");
  const thumbs = h("div", "kpx-thumbs");
  thumbs.setAttribute("role", "tablist");
  thumbs.setAttribute("aria-label", "Фотографии");
  const gallery = h("section", "kpx-gallery", track, thumbs);

  // ---------- Back (glass control over the photos) ----------
  const back = createIconButton({ icon: "arrow-left", ariaLabel: "Назад в каталог", iconSize: "large", onClick: () => onBack() });
  const top = h("div", "kpx-top", back);

  // ---------- Floating information panel ----------
  const condition = h("p", "kpx-condition ds-text-body-s");
  const name = h("h1", "kpx-name");
  name.id = "productXTitle";
  const price = h("p", "kpx-price");
  const cta = pill(createButton({ label: "Добавить в примерку", variant: "primary", width: "fill", onClick: () => toggle() }));
  cta.classList.add("kpx-cta");
  const ctaLabel = cta.querySelector(".ds-button__label");
  const limit = h("div", "kpx-limit", h("p", "ds-text-body-s", "В примерку — не больше 5 лотов. Уберите один, чтобы добавить этот"), createTextAction({ label: "Открыть примерку", onClick: () => onOpenFitting() }));
  limit.setAttribute("role", "status");
  limit.hidden = true;
  const infoBody = h("div", "kpx-attrs");
  const sizeBody = h("div", "kpx-attrs");
  const sections = h("div", "kpx-sections", accordion("info", "Информация о лоте", infoBody), accordion("sizes", "Размеры", sizeBody));
  // Fixed part (identity + primary action) and a scrollable part (accordions): expanding never pushes the button away.
  const fixed = h("div", "kpx-panel__fixed", h("div", "kpx-head", condition, name, price), h("div", "kpx-actions", cta, limit));
  const scroll = h("div", "kpx-panel__scroll", sections);
  const panel = h("section", "kpx-panel ds-corner", fixed, scroll);
  scroll.addEventListener("scroll", () => scroll.toggleAttribute("data-scrolled", scroll.scrollTop > 2), { passive: true });
  panel.setAttribute("aria-labelledby", "productXTitle");

  root.append(gallery, top, panel);

  // Accordion: header button with the kit plus/minus icons; the body animates its height (grid rows 0fr → 1fr).
  function accordion(key, title, content) {
    const btn = h("button", "kpx-acc__head",
      h("span", "kpx-acc__title", title),
      h("span", "kpx-acc__icon", h("span", "kpx-acc__plus", createIcon("plus", { size: 20 })), h("span", "kpx-acc__minus", createIcon("minus", { size: 20 }))));
    btn.type = "button";
    const bodyId = `kpxAcc-${key}`;
    btn.setAttribute("aria-controls", bodyId);
    btn.setAttribute("aria-expanded", "false");
    const body = h("div", "kpx-acc__body", h("div", "kpx-acc__inner", content));
    body.id = bodyId;
    const sec = h("section", "kpx-acc", btn, body);
    sec.dataset.key = key;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      sec.toggleAttribute("data-open", open);
      // keep the opened section in view inside the panel's own scroll area (small iPads)
      if (open) setTimeout(() => scroll.scrollTo({ top: Math.min(sec.offsetTop, scroll.scrollHeight), behavior: "smooth" }), 280);
    });
    return sec;
  }

  // ---------- Gallery behaviour: free scrolling, active = most visible photo ----------
  const photos = () => [...track.children];
  function mostVisible() {
    const vw = track.clientWidth; let best = 0, bestW = -1;
    photos().forEach((p, i) => {
      const l = p.offsetLeft - track.scrollLeft, r = l + p.offsetWidth;
      const w = Math.max(0, Math.min(r, vw) - Math.max(l, 0));
      if (w > bestW + 0.5) { bestW = w; best = i; }
    });
    return best;
  }
  function paintThumbs({ follow = true } = {}) {
    [...thumbs.children].forEach((b, k) => b.setAttribute("aria-selected", String(k === index)));
    const a = thumbs.children[index];
    if (follow && a) { // keep the active thumbnail inside the strip (the strip scrolls, the page never does)
      const l = a.offsetLeft, r = l + a.offsetWidth;
      if (l < thumbs.scrollLeft) thumbs.scrollTo({ left: l - 6, behavior: "smooth" });
      else if (r > thumbs.scrollLeft + thumbs.clientWidth) thumbs.scrollTo({ left: r - thumbs.clientWidth + 6, behavior: "smooth" });
    }
  }
  // Programmatic scroll (thumbnail tap, fullscreen) puts photo i at the left edge, clamped to the strip's end.
  function scrollToPhoto(i, { smooth = true } = {}) {
    const p = photos()[i];
    if (!p) return;
    track.scrollTo({ left: Math.min(p.offsetLeft, track.scrollWidth - track.clientWidth), behavior: smooth ? "smooth" : "instant" });
  }
  function goTo(i) { scrollToPhoto(i, { smooth: false }); index = i; paintThumbs(); }
  // Scroll position in photo units (3.4 = 40 % into the 4th photo). When the fitting tray appears / disappears the
  // gallery's height animates, every photo resizes (3:4), and the same photo position is re-applied on each frame —
  // the strip doesn't jump and nothing is re-rendered.
  let pos = 0;
  let resizing = false;
  const step = () => {
    const p = track.firstElementChild;
    return p ? p.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : 0;
  };
  let lastH = 0;
  new ResizeObserver(() => {
    const hgt = track.clientHeight;
    if (!hgt || hgt === lastH) return;
    lastH = hgt;
    const s = step();
    if (!s) return;
    resizing = true;
    track.scrollLeft = pos * s;
    requestAnimationFrame(() => { resizing = false; });
  }).observe(track);
  track.addEventListener("scroll", () => {
    if (!resizing) { const s = step(); pos = s ? track.scrollLeft / s : 0; }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const i = mostVisible(); if (i !== index) { index = i; paintThumbs(); } });
  }, { passive: true });

  function buildGallery() {
    const n = product.gallery.length;
    track.replaceChildren(...product.gallery.map((g, i) => {
      const img = h("img", "kpx-photo__image");
      Object.assign(img, { src: g.src, alt: `${product.brand} ${product.name}, фото ${i + 1} из ${n}`, draggable: false, decoding: "async", loading: i < 3 ? "eager" : "lazy" });
      const b = h("button", "kpx-photo", img);
      b.type = "button";
      b.setAttribute("aria-label", `Открыть фото ${i + 1} из ${n} на весь экран`);
      b.addEventListener("click", () => openAt(i));
      return b;
    }));
    thumbs.replaceChildren(...product.gallery.map((g, i) => {
      const img = h("img", null);
      Object.assign(img, { src: g.thumb, alt: "", draggable: false, decoding: "async" });
      const b = h("button", "kpx-thumb", img);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `Фото ${i + 1} из ${n}`);
      b.addEventListener("click", () => { index = i; paintThumbs(); scrollToPhoto(i); });
      return b;
    }));
    thumbs.hidden = n < 2;
    track.scrollLeft = 0;
    pos = 0;
    thumbs.scrollLeft = 0;
    index = 0;
    paintThumbs({ follow: false });
    root.style.setProperty("--kpx-thumbs-w", `${thumbs.hidden ? 0 : thumbs.getBoundingClientRect().width || 0}px`);
  }

  function openAt(i) {
    if (pswp) return;
    pswp = openFullscreen({
      product,
      index: i,
      thumbFor: (k) => track.children[k]?.querySelector("img"),
      onChange: (k) => goTo(k), // closing lands on the photo viewed last
      onClose: () => { pswp = null; },
    });
  }

  // ---------- Information (catalog/lot-details.js: real attributes first, marked demo defaults for the rest) ----------
  function buildInfo() {
    const d = lotDetails(product);
    const rows = (list) => list.map((r) => {
      const row = h("p", "kpx-attr", h("span", "kpx-attr__label", `${r.label}:`), " ", h("span", "kpx-attr__value", r.value));
      if (r.demo) row.dataset.demo = "";
      return row;
    });
    const note = (list) => (list.some((r) => r.demo) ? h("p", "kpx-demo", "Часть значений — демонстрационные, для макета") : null);
    infoBody.replaceChildren(...rows(d.info), note(d.info) ?? "");
    sizeBody.replaceChildren(...rows(d.sizes), note(d.sizes) ?? "");
    for (const sec of sections.children) { sec.removeAttribute("data-open"); sec.querySelector(".kpx-acc__head").setAttribute("aria-expanded", "false"); }
  }

  // ---------- Fitting ----------
  function toggle() {
    const res = selection.toggle(product.id);
    if (!res.ok && res.reason === "limit") limit.hidden = false;
  }
  // Gallery state A (no tray, full height) / B (tray shown, photos end just above it). Animated on selection changes,
  // instant when the page opens (settle = true).
  function paintLayout({ settle = false } = {}) {
    const tray = selection.size > 0;
    if (root.hasAttribute("data-tray") === tray) return;
    if (settle) root.classList.add("is-settling");
    root.toggleAttribute("data-tray", tray);
    if (settle) { void root.offsetWidth; requestAnimationFrame(() => root.classList.remove("is-settling")); }
  }
  function paintFitting(change = {}) {
    if (!product) return;
    paintLayout();
    const on = selection.has(product.id);
    cta.dataset.variant = on ? "secondary" : "primary";
    ctaLabel.textContent = on ? "Убрать из примерки" : "Добавить в примерку";
    cta.setAttribute("aria-pressed", String(on));
    if (on || !selection.full) limit.hidden = true;
    if (change.id === product.id) { cta.classList.remove("is-changed"); void cta.offsetWidth; cta.classList.add("is-changed"); }
  }

  function show(id) {
    const p = byId.get(id);
    if (!p) return false;
    paintLayout({ settle: true });
    if (product?.id !== id) {
      product = p;
      condition.textContent = p.condition;
      name.textContent = `${p.brand} ${p.name}`;
      price.textContent = money(p.price);
      buildInfo();
      buildGallery();
      limit.hidden = true;
      scroll.scrollTop = 0;
      root.classList.remove("is-entering");
      void root.offsetWidth;
      root.classList.add("is-entering");
    }
    paintFitting();
    return true;
  }

  return {
    show,
    onSelectionChange: (change) => paintFitting(change),
    close: ({ immediate = false } = {}) => { if (pswp) (immediate ? pswp.destroy() : pswp.close()); },
    reset() { if (pswp) pswp.destroy(); product = null; },
    get state() { return { id: product?.id ?? null, index, photos: product?.gallery.length ?? 0, fullscreen: !!pswp, fullscreenIndex: pswp?.currIndex ?? null, scrollLeft: track.scrollLeft, position: pos }; },
  };
}
