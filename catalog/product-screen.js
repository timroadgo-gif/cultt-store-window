// Карточка товара (iPad landscape), редизайн 2026-11-17. Решение и ссылки — docs/pdp-decision.md.
//   • Слева два крупных фото 3:4 рядом (как первый ряд галереи на сайте THE CULTT). Лента листается свайпом по одному
//     кадру (нативный scroll-snap); под ней тихая строка «1–2 из 11» и две компактные стрелки.
//   • Тап по фото — полноэкранный просмотр PhotoSwipe 5 (свайп, щипок, панорама, двойной тап); после закрытия лента
//     показывает просмотренное фото.
//   • Справа колонка: «Бренд Модель», тип, цена → «Добавить в примерку» / «Убрать из примерки» → характеристики.
//   • Без статуса «В примерке · N из 5»: выбор виден по кнопке и в панели примерки.
// Выбор на примерку — общий selection (тот же, что у каталога, панели и шторки).
import { createButton } from "../design-system/components/button/button.js?v=c4dc60a7b65c";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=c4dc60a7b65c";
import { createIcon } from "../design-system/icons/icon.js?v=c4dc60a7b65c";
import { openFullscreen } from "./fullscreen.js?v=c4dc60a7b65c";
import { money } from "./filters.js?v=c4dc60a7b65c";
import { pill } from "./ui.js?v=c4dc60a7b65c";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const VISIBLE = 2; // photos on screen at once

export function mountProduct(root, { byId, selection, onBack, onOpenFitting }) {
  let product = null;
  let index = 0; // leftmost visible photo
  let pswp = null;
  let raf = 0;

  // ---------- Header: compact back + brand ----------
  const back = createTextAction({ label: "Каталог", onClick: () => onBack() });
  back.classList.add("kp-back");
  back.setAttribute("aria-label", "Назад в каталог");
  back.prepend(h("span", "kp-back__icon", createIcon("arrow-left", { size: 20 })));
  const logo = h("div", "brand brand--compact kp-logo", h("span", "brand__logo"));
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "THE CULTT");
  const bar = h("header", "kp-bar", h("div", "kp-bar__start", back), logo, h("div", "kp-bar__end"));

  // ---------- Gallery: two 3:4 photos side by side ----------
  const track = h("div", "kp-track");
  const count = h("p", "kp-count ds-text-body-s");
  count.setAttribute("aria-live", "polite");
  const arrow = (dir) => {
    const b = createButton({ variant: "secondary", iconPosition: "only", icon: dir < 0 ? "chevron-left" : "chevron-right", ariaLabel: dir < 0 ? "Предыдущее фото" : "Следующее фото", onClick: () => goTo(index + dir, { smooth: !reducedMotion() }) });
    b.classList.add("kc-tool", "kp-arrow");
    b.dataset.corner = "circular";
    return b;
  };
  const prev = arrow(-1);
  const next = arrow(1);
  const controls = h("div", "kp-gallery__controls", count, h("div", "kp-arrows", prev, next));
  const gallery = h("section", "kp-gallery", track, controls);
  gallery.setAttribute("aria-label", "Фотографии лота");

  // ---------- Info ----------
  const title = h("h1", "kp-title");
  title.id = "productTitle";
  const kind = h("p", "kp-kind ds-text-body");
  const price = h("p", "kp-price");
  const cta = createButton({ label: "Добавить в примерку", variant: "primary", width: "fill", onClick: () => toggle() });
  cta.classList.add("kp-cta");
  pill(cta);
  const ctaLabel = cta.querySelector(".ds-button__label");
  const limitText = h("p", "ds-text-body-s", "В примерку — не больше 5 лотов. Уберите один, чтобы добавить этот");
  const openFitting = createTextAction({ label: "Открыть примерку", onClick: () => onOpenFitting() });
  const limit = h("div", "kp-limit", limitText, openFitting);
  limit.setAttribute("role", "status");
  limit.hidden = true;
  const details = h("dl", "kp-details");
  details.setAttribute("aria-label", "Характеристики");
  const info = h("section", "kp-info",
    h("div", "kp-head", title, kind, price),
    h("div", "kp-actions", cta, limit),
    details);
  info.setAttribute("aria-labelledby", "productTitle");

  const body = h("div", "kp-body", gallery, info);
  root.append(bar, body);

  // ---------- Gallery behaviour ----------
  function buildGallery() {
    const imgs = product.gallery;
    track.replaceChildren(...imgs.map((g, i) => {
      const img = h("img", "kp-slide__image");
      Object.assign(img, { src: g.src, alt: `${product.brand} ${product.name}, фото ${i + 1} из ${imgs.length}`, draggable: false, decoding: "async", loading: i < 4 ? "eager" : "lazy" });
      const slide = h("button", "kp-slide ds-corner", img);
      slide.type = "button";
      slide.setAttribute("aria-label", `Открыть фото ${i + 1} из ${imgs.length} на весь экран`);
      slide.addEventListener("click", () => openFullscreenAt(i));
      return slide;
    }));
    track.scrollLeft = 0;
    paint(0);
  }
  const step = () => (track.children[1] ? track.children[1].offsetLeft - track.children[0].offsetLeft : track.clientWidth) || 1;
  const maxIndex = () => Math.max(0, (product?.gallery.length ?? 0) - VISIBLE);
  function goTo(i, { smooth = false } = {}) {
    const t = Math.max(0, Math.min(maxIndex(), i));
    track.scrollTo({ left: t * step(), behavior: smooth ? "smooth" : "instant" });
    if (!smooth) paint(t);
  }
  function paint(i) {
    index = i;
    const n = product.gallery.length;
    count.textContent = n > 1 ? `${i + 1}–${Math.min(i + VISIBLE, n)} из ${n}` : "1 из 1";
    prev.disabled = i <= 0;
    next.disabled = i >= maxIndex();
    controls.hidden = n <= VISIBLE;
  }
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / step()); if (i !== index) paint(i); });
  }, { passive: true });
  new ResizeObserver(() => { if (product) track.scrollLeft = index * step(); }).observe(track);

  // ---------- Fullscreen (shared viewer, catalog/fullscreen.js) ----------
  function openFullscreenAt(i) {
    if (pswp) return;
    pswp = openFullscreen({
      product,
      index: i,
      thumbFor: (k) => track.children[k]?.querySelector("img"),
      // Keep the viewed photo on screen in the gallery (it becomes the left one, or the right one at the end).
      onChange: (k) => { if (k < index || k >= index + VISIBLE) goTo(k); },
      onClose: () => { pswp = null; },
    });
  }
  function closeFullscreen({ immediate = false } = {}) {
    if (!pswp) return;
    if (immediate) pswp.destroy(); else pswp.close();
  }

  // ---------- Fitting ----------
  function toggle() {
    const res = selection.toggle(product.id);
    if (!res.ok && res.reason === "limit") {
      limit.hidden = false;
      limit.classList.remove("is-shown");
      void limit.offsetWidth;
      limit.classList.add("is-shown");
    }
  }
  function paintFitting(change = {}) {
    if (!product) return;
    const on = selection.has(product.id);
    cta.dataset.variant = on ? "secondary" : "primary";
    ctaLabel.textContent = on ? "Убрать из примерки" : "Добавить в примерку";
    cta.setAttribute("aria-pressed", String(on));
    if (on || !selection.full) limit.hidden = true;
    if (change.id === product.id) {
      cta.classList.remove("is-changed");
      void cta.offsetWidth;
      cta.classList.add("is-changed");
    }
  }

  // ---------- Attributes: only those present in the data ----------
  function buildDetails() {
    const rows = [
      ["Состояние", product.condition],
      ["Цвет", product.color],
      ["Материал", product.material],
      ["Размер", product.size],
      ["Комплект", product.kit],
      ["Артикул", product.article],
    ].filter(([, v]) => v);
    details.replaceChildren(...rows.map(([k, v]) => h("div", "kp-details__row", h("dt", "kp-details__label ds-text-body-s", k), h("dd", "kp-details__value ds-text-body", v))));
  }

  function show(id) {
    const p = byId.get(id);
    if (!p) return false;
    if (product?.id !== id) {
      product = p;
      title.textContent = `${p.brand} ${p.name}`;
      kind.textContent = p.subcategory;
      price.textContent = money(p.price);
      buildDetails();
      buildGallery();
      limit.hidden = true;
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
    close: (opts) => closeFullscreen(opts),
    reset() { closeFullscreen({ immediate: true }); product = null; },
    get state() { const s = pswp?.currSlide; return { id: product?.id ?? null, index, photos: product?.gallery.length ?? 0, fullscreen: !!pswp, fullscreenIndex: pswp?.currIndex ?? null, zoom: s?.currZoomLevel ?? null, zoomFit: s?.zoomLevels.initial ?? null, panX: s?.pan.x ?? null, panY: s?.pan.y ?? null }; },
  };
}
