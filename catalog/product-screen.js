// Карточка товара (iPad landscape). Решение — гибрид «большое фото + миниатюры»:
//   • слева вертикальная лента миниатюр (прямой выбор фото, текущее отмечено рамкой);
//   • главное фото 3:4 на всю доступную высоту, листается свайпом (нативный scroll-snap, как галерея мобильного
//     каталога), под ним GalleryPager UI Kit (одобрен на PDP THE CULTT);
//   • тап по фото — полноэкранный просмотр PhotoSwipe 5 (свайп, щипок, панорама, двойной тап, счетчик, закрытие);
//     после закрытия главное фото остается на том снимке, который смотрели;
//   • справа неподвижная колонка: бренд + модель, тип, цена, «Примерить», короткий список характеристик.
// Выбор на примерку — общий selection (тот же, что у каталога, панели и шторки); своего состояния нет.
import PhotoSwipe from "../vendor/photoswipe/photoswipe.esm.min.js?v=d13d2bae4b12";
import { createButton } from "../design-system/components/button/button.js?v=d13d2bae4b12";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=d13d2bae4b12";
import { createGalleryPager } from "../design-system/components/gallery-pager/gallery-pager.js?v=d13d2bae4b12";
import { createIcon, iconMarkup } from "../design-system/icons/icon.js?v=d13d2bae4b12";
import { money } from "./filters.js?v=d13d2bae4b12";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const PHOTO = { w: 960, h: 1280 };

export function mountProduct(root, { byId, selection, onBack, onOpenFitting }) {
  let product = null;
  let index = 0;
  let pswp = null;
  let raf = 0;

  // ---------- Header: back + brand ----------
  const back = createButton({ label: "Назад в каталог", variant: "secondary", iconPosition: "leading", icon: "chevron-left", onClick: () => onBack() });
  const logo = h("div", "brand brand--compact kp-logo", h("span", "brand__logo"));
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "THE CULTT");
  const bar = h("header", "kp-bar", h("div", "kp-bar__start", back), logo, h("div", "kp-bar__end"));

  // ---------- Gallery ----------
  const thumbs = h("div", "kp-thumbs");
  thumbs.setAttribute("role", "tablist");
  thumbs.setAttribute("aria-label", "Фотографии");
  const track = h("div", "kp-track");
  const pagerSlot = h("div", "kp-pager");
  const main = h("div", "kp-main ds-corner", track, pagerSlot);
  const gallery = h("section", "kp-gallery", thumbs, main);
  gallery.setAttribute("aria-label", "Фотографии лота");

  // ---------- Info ----------
  const title = h("h1", "kp-title");
  title.id = "productTitle";
  const kind = h("p", "kp-kind ds-text-body");
  const price = h("p", "kp-price");
  const status = h("p", "kp-status ds-text-body", h("span", "kp-status__icon ds-corner", createIcon("check", { size: 16 })), h("span", "kp-status__text"));
  status.setAttribute("aria-live", "polite");
  status.firstChild.dataset.corner = "circular";
  const add = createButton({ label: "Примерить", variant: "primary", width: "fill", onClick: () => toggle() });
  const remove = createButton({ label: "Убрать из примерки", variant: "secondary", width: "fill", onClick: () => toggle() });
  const note = h("p", "kp-note ds-text-body-s", "Принесем со склада — обычно это несколько минут");
  const limitText = h("span", null, "В примерку — не больше 5 лотов. Уберите один, чтобы добавить этот");
  const openFitting = createTextAction({ label: "Открыть примерку", onClick: () => onOpenFitting() });
  const limit = h("div", "kp-limit ds-corner", h("p", "ds-text-body-s", limitText), openFitting);
  limit.setAttribute("role", "status");
  limit.hidden = true;
  const actions = h("div", "kp-actions", status, add, remove, limit, note);
  const details = h("dl", "kp-details");
  const info = h("section", "kp-info", h("div", "kp-head", title, kind, price), actions, h("div", "kp-about", h("h2", "kp-about__title ds-text-overline", "О лоте"), details));
  info.setAttribute("aria-labelledby", "productTitle");

  const body = h("div", "kp-body", gallery, info);
  root.append(bar, body);

  // ---------- Gallery behaviour ----------
  let pager = null;
  function buildGallery() {
    const imgs = product.gallery;
    track.replaceChildren(...imgs.map((g, i) => {
      const img = h("img", "kp-slide__image");
      Object.assign(img, { src: g.src, alt: `${product.brand} ${product.name}, фото ${i + 1} из ${imgs.length}`, draggable: false, decoding: "async", loading: i < 2 ? "eager" : "lazy" });
      const slide = h("button", "kp-slide", img);
      slide.type = "button";
      slide.setAttribute("aria-label", `Открыть фото ${i + 1} из ${imgs.length} на весь экран`);
      slide.addEventListener("click", () => openFullscreen(i));
      return slide;
    }));
    thumbs.replaceChildren(...imgs.map((g, i) => {
      const img = h("img", null);
      Object.assign(img, { src: g.thumb, alt: "", draggable: false, decoding: "async" });
      const b = h("button", "kp-thumb ds-corner", img);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `Фото ${i + 1} из ${imgs.length}`);
      b.addEventListener("click", () => goTo(i, { smooth: !reducedMotion() }));
      return b;
    }));
    pager = createGalleryPager({ count: imgs.length });
    pagerSlot.replaceChildren(pager);
    track.scrollLeft = 0;
    index = 0;
    paintIndex(0, { scrollThumb: false });
    thumbs.scrollTop = 0;
  }

  function slideWidth() { return track.clientWidth || 1; }
  function goTo(i, { smooth = false } = {}) {
    track.scrollTo({ left: i * slideWidth(), behavior: smooth ? "smooth" : "instant" });
    if (!smooth) paintIndex(i);
  }
  function paintIndex(i, { scrollThumb = true } = {}) {
    index = i;
    [...thumbs.children].forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
    if (scrollThumb) thumbs.children[i]?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "instant" : "smooth" });
  }
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const progress = track.scrollLeft / slideWidth();
      pager?.setProgress(progress);
      const i = Math.round(progress);
      if (i !== index) paintIndex(i);
    });
  }, { passive: true });
  // Keep the current photo in place if the frame size changes (other iPad sizes, safe areas).
  new ResizeObserver(() => { if (product) track.scrollLeft = index * slideWidth(); }).observe(track);

  // ---------- Fullscreen (PhotoSwipe) ----------
  const icon = (name, cls) => iconMarkup(name, { size: 24 }).replace('class="ds-icon"', `class="ds-icon pswp__icn ${cls}"`);
  function openFullscreen(i) {
    if (pswp) return;
    pswp = new PhotoSwipe({
      dataSource: product.gallery.map((g) => ({ src: g.src, msrc: g.src, width: PHOTO.w, height: PHOTO.h, alt: `${product.brand} ${product.name}` })),
      index: i,
      bgOpacity: 1,
      showHideAnimationType: reducedMotion() ? "none" : "zoom",
      showAnimationDuration: 280,
      hideAnimationDuration: 240,
      initialZoomLevel: "fit",
      secondaryZoomLevel: 1.5, // double tap → 1.5 × the 960 × 1280 source (≈ 2.4 × the fitted size on iPad)
      maxZoomLevel: 3,
      wheelToZoom: true,
      loop: false,
      pinchToClose: false,
      closeOnVerticalDrag: true,
      imageClickAction: "zoom-or-close",
      tapAction: "toggle-controls",
      doubleTapAction: "zoom",
      bgClickAction: "close",
      paddingFn: () => ({ top: 24, bottom: 24, left: 72, right: 72 }),
      closeTitle: "Закрыть",
      zoomTitle: "Увеличить",
      arrowPrevTitle: "Предыдущее фото",
      arrowNextTitle: "Следующее фото",
      indexIndicatorSep: " / ",
      closeSVG: icon("close", "kp-pswp-close"),
      zoomSVG: icon("search", "kp-pswp-zoom"),
      arrowPrevSVG: icon("chevron-left", "kp-pswp-arrow"),
      arrowNextSVG: icon("chevron-right", "kp-pswp-arrow"),
      mainClass: "kp-pswp",
      returnFocus: false, // the default would focus the photo it opened from and scroll the gallery back to it
    });
    // Open/close «zoom» from the photo that is on screen in the gallery.
    pswp.addFilter("thumbEl", (el, data, k) => track.children[k]?.querySelector("img") ?? el);
    pswp.addFilter("placeholderSrc", (src, slide) => product.gallery[slide.index]?.src ?? src);
    pswp.on("change", () => goTo(pswp.currIndex)); // the gallery follows, so closing lands on the same photo
    pswp.on("destroy", () => { pswp = null; track.children[index]?.focus({ preventScroll: true }); });
    pswp.init();
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
    add.hidden = on;
    remove.hidden = !on;
    status.hidden = !on;
    status.querySelector(".kp-status__text").textContent = `В примерке · ${selection.size} из ${selection.limit}`;
    if (on || !selection.full) limit.hidden = true;
    if (change.type === "add" && change.id === product.id) {
      status.classList.remove("is-new");
      void status.offsetWidth;
      status.classList.add("is-new");
    }
  }

  // ---------- Details: only attributes present in the data ----------
  function buildDetails() {
    const rows = [
      ["Состояние", product.condition],
      ["Цвет", product.color],
      ["Материал", product.material],
      ["Размер", product.size],
      ["Комплект", product.kit],
      ["Артикул", product.article],
    ].filter(([, v]) => v);
    details.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", "kp-details__label ds-text-body-s", k), h("dd", "kp-details__value ds-text-body", v)]));
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
