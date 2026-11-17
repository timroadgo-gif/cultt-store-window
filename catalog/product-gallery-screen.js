// ЭКСПЕРИМЕНТ — карточка товара «галерея» (по образцу страницы товара Hermès, айдентика THE CULTT).
// Маршрут #/product-x/<id>; стандартная карточка (product-screen.js) не меняется — варианты переключаются в симуляторе.
//   • Фото во всю высоту экрана, 3:4 (ширина = высота × 3/4), идут лентой вправо и уходят за край экрана;
//     горизонтальная прокрутка — нативная (инерция, мягкий snap по кадрам). Счетчик «1 / 13» внизу слева.
//   • Тап по фото — общий полноэкранный просмотр (fullscreen.js); после закрытия лента стоит на просмотренном фото.
//   • Справа внизу — компактная белая панель поверх фото: состояние · «Бренд Модель» · цена · «Добавить в примерку» /
//     «Убрать из примерки» · аккордеоны «Информация о лоте» и «Размеры». Панель растет вверх (нижний край закреплен
//     над панелью примерки); если не помещается — ее содержимое прокручивается.
//   • Назад — стеклянная кнопка UI Kit (GlassIconButton) слева вверху.
// Выбор на примерку — тот же общий selection, что у каталога, стандартной карточки, панели и шторки.
import { createButton } from "../design-system/components/button/button.js?v=00dd94ce5b19";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=00dd94ce5b19";
import { createIconButton } from "../design-system/components/icon-button/icon-button.js?v=00dd94ce5b19";
import { createIcon } from "../design-system/icons/icon.js?v=00dd94ce5b19";
import { money } from "./filters.js?v=00dd94ce5b19";
import { pill } from "./ui.js?v=00dd94ce5b19";
import { openFullscreen } from "./fullscreen.js?v=00dd94ce5b19";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

export function mountProductGallery(root, { byId, selection, onBack, onOpenFitting }) {
  let product = null;
  let index = 0; // leftmost photo
  let pswp = null;
  let raf = 0;

  // ---------- Gallery ----------
  const track = h("div", "kpx-track");
  track.setAttribute("aria-label", "Фотографии лота, листаются вправо");
  const counter = h("p", "kpx-counter");
  counter.setAttribute("aria-live", "polite");
  const gallery = h("section", "kpx-gallery", track, counter);

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
  const infoBody = h("dl", "kpx-attrs");
  const sizeBody = h("div", "kpx-sizes");
  const sections = h("div", "kpx-sections", accordion("info", "Информация о лоте", infoBody), accordion("sizes", "Размеры", sizeBody));
  const scroll = h("div", "kpx-panel__scroll", h("div", "kpx-head", condition, name, price), h("div", "kpx-actions", cta, limit), sections);
  const panel = h("section", "kpx-panel ds-corner", scroll);
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
      if (open) setTimeout(() => sec.scrollIntoView({ block: "nearest", behavior: "smooth" }), 260); // keep it reachable on small iPads
    });
    return sec;
  }

  // ---------- Gallery behaviour ----------
  const step = () => (track.children[1] ? track.children[1].offsetLeft - track.children[0].offsetLeft : track.clientWidth) || 1;
  function paintCounter() {
    const n = product.gallery.length;
    counter.textContent = `${index + 1} / ${n}`;
  }
  function goTo(i) {
    const t = Math.max(0, Math.min(product.gallery.length - 1, i));
    track.scrollTo({ left: Math.min(t * step(), track.scrollWidth - track.clientWidth), behavior: "instant" });
    index = t;
    paintCounter();
  }
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      const i = atEnd ? product.gallery.length - 1 : Math.round(track.scrollLeft / step());
      if (i !== index) { index = i; paintCounter(); }
      gallery.toggleAttribute("data-at-end", atEnd);
    });
  }, { passive: true });

  function buildGallery() {
    track.replaceChildren(...product.gallery.map((g, i) => {
      const img = h("img", "kpx-photo__image");
      Object.assign(img, { src: g.src, alt: `${product.brand} ${product.name}, фото ${i + 1} из ${product.gallery.length}`, draggable: false, decoding: "async", loading: i < 3 ? "eager" : "lazy" });
      const b = h("button", "kpx-photo", img);
      b.type = "button";
      b.setAttribute("aria-label", `Открыть фото ${i + 1} из ${product.gallery.length} на весь экран`);
      b.addEventListener("click", () => openAt(i));
      return b;
    }));
    track.scrollLeft = 0;
    index = 0;
    gallery.removeAttribute("data-at-end");
    paintCounter();
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

  // ---------- Information ----------
  function buildInfo() {
    const rows = [
      ["Состояние", product.condition],
      ["Материал", product.material],
      ["Цвет", product.color],
      ["Комплект", product.kit],
      ["Артикул", product.article],
    ].filter(([, v]) => v);
    infoBody.replaceChildren(...rows.map(([k, v]) => h("div", "kpx-attr", h("dt", "ds-text-body-s", k), h("dd", "ds-text-body", v))));
    // No size / dimensions in the lot data: say so instead of inventing numbers.
    sizeBody.replaceChildren(product.size
      ? h("p", "ds-text-body", product.size)
      : h("p", "kpx-sizes__empty ds-text-body", "Размеры этого лота не указаны в карточке"));
    for (const sec of sections.children) { sec.removeAttribute("data-open"); sec.querySelector(".kpx-acc__head").setAttribute("aria-expanded", "false"); }
  }

  // ---------- Fitting ----------
  function toggle() {
    const res = selection.toggle(product.id);
    if (!res.ok && res.reason === "limit") limit.hidden = false;
  }
  function paintFitting(change = {}) {
    if (!product) return;
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
    get state() { return { id: product?.id ?? null, index, photos: product?.gallery.length ?? 0, fullscreen: !!pswp, fullscreenIndex: pswp?.currIndex ?? null }; },
  };
}
