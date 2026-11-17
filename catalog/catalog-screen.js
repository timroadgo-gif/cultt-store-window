// Каталог витрины (iPad, landscape): шапка (логотип, поиск, фильтры), категории + сортировка, активные фильтры и
// число лотов, сетка карточек с выбором на примерку, панель примерки. Состояние каталога — в памяти, сбрасывается
// reset() (по бездействию). Выбор на примерку живёт в selection и не сбрасывается при поиске / фильтрах / сортировке.
import { createButton } from "../design-system/components/button/button.js?v=ae10f1e9ab31";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=ae10f1e9ab31";
import { createIcon } from "../design-system/icons/icon.js?v=ae10f1e9ab31";
import {
  CATEGORIES, SORT_OPTIONS, applyCatalog, activeFilterChips, clearFilters, createCatalogState, lotsWord, money,
} from "./filters.js?v=ae10f1e9ab31";
import { openFilterSheet } from "./filter-sheet.js?v=ae10f1e9ab31";
import { createFittingPanel } from "./fitting-panel.js?v=ae10f1e9ab31";
import { createFittingSheet } from "./fitting-sheet.js?v=ae10f1e9ab31";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

const FILTERS_ICON_URL = "assets/filters.svg";
let filtersIconMarkup = null;
const loadFiltersIcon = () => (filtersIconMarkup ??= fetch(FILTERS_ICON_URL).then((r) => r.text()).catch(() => ""));

export function mountCatalog(root, { products, selection, onSubmitFitting, onOpenProduct, onAddMore }) {
  const state = createCatalogState();
  const byId = new Map(products.map((p) => [p.id, p]));

  // ---------- Header ----------
  const logo = h("div", "brand brand--compact kc-logo");
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "THE CULTT");
  logo.append(h("span", "brand__logo"));

  // Search: UI Kit Field markup (single-line field without a visible label, min-height 44) + search icon.
  const search = h("label", "ds-field ds-corner kc-search");
  search.dataset.kind = "text";
  const searchIcon = h("span", "kc-search__icon", createIcon("search", { size: 20 }));
  searchIcon.setAttribute("aria-hidden", "true");
  const input = h("input", "ds-field__input ds-text-input kc-search__input");
  Object.assign(input, { type: "search", placeholder: "Бренд, модель или артикул", autocomplete: "off", enterKeyHint: "search", spellcheck: false });
  input.setAttribute("aria-label", "Поиск по бренду, модели или артикулу");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  const clearSearch = h("button", "kc-search__clear", createIcon("close", { size: 20 }));
  Object.assign(clearSearch, { type: "button", hidden: true });
  clearSearch.setAttribute("aria-label", "Очистить поиск");
  search.append(searchIcon, h("span", "ds-field__content", input), clearSearch);

  const filtersSlot = h("div", "kc-filters-slot");
  // Sort lives with Filters in the first row (filter + sort = one control group); the menu drops below it.
  const sortButton = createButton({ label: "Сначала новые", variant: "secondary", iconPosition: "trailing", icon: "chevron-down" });
  sortButton.classList.add("kc-sort");
  sortButton.setAttribute("aria-haspopup", "menu");
  sortButton.setAttribute("aria-expanded", "false");
  const sortLabel = sortButton.querySelector(".ds-button__label");
  const sortWrap = h("div", "kc-sort-wrap", sortButton);
  const top = h("header", "kc-top", logo, search, h("div", "kc-controls", filtersSlot, sortWrap));

  // ---------- Categories + sort ----------
  const tabs = h("div", "kc-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Категории");
  const tabButtons = CATEGORIES.map((c) => {
    const b = h("button", "kc-tab ds-text-heading-s", c.label);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.category = c.id;
    b.addEventListener("click", () => { if (state.category !== c.id) { state.category = c.id; update({ animate: true, scrollTop: true }); } });
    return b;
  });
  tabs.append(...tabButtons);

  const nav = h("nav", "kc-nav", tabs);
  nav.setAttribute("aria-label", "Категории");

  // ---------- Meta row: active filters + count ----------
  const chipsBox = h("div", "kc-chips");
  const resetAll = createTextAction({ label: "Сбросить все", onClick: () => { clearFilters(state); update({ animate: true }); } });
  resetAll.classList.add("kc-reset");
  const count = h("p", "kc-count ds-text-body");
  count.setAttribute("aria-live", "polite");
  const meta = h("div", "kc-meta", chipsBox, count);

  // ---------- Grid ----------
  const grid = h("div", "kc-grid");
  grid.setAttribute("role", "list");
  const empty = h("div", "kc-empty");
  empty.hidden = true;
  const emptyTitle = h("p", "kc-empty__title");
  const emptyText = h("p", "kc-empty__text ds-text-body");
  const emptyAction = h("div", "kc-empty__action");
  empty.append(emptyTitle, emptyText, emptyAction);
  const scroller = h("div", "kc-scroll", meta, grid, empty);
  scroller.dataset.scrollReset = "";

  const toast = h("div", "kc-toast ds-corner ds-text-body");
  toast.setAttribute("role", "status");
  toast.hidden = true;

  // «Открыть примерку» → bottom sheet over the catalog; it reads and edits the same selection.
  const fittingSheet = createFittingSheet({ byId, selection, onSubmit: () => onSubmitFitting?.(), onAddMore: () => onAddMore?.() });
  const panel = createFittingPanel({ byId, limit: selection.limit, onOpen: () => { closeMenu(); hideToast(); fittingSheet.open(); } });
  root.append(top, nav, scroller, toast, panel.el);

  // Cards are created once and re-ordered on every update, so selection state and loaded photos survive.
  const cards = new Map(products.map((p) => [p.id, createCard(p)]));

  function createCard(p) {
    const media = h("div", "kc-card__media ds-corner");
    const img = h("img", "kc-card__image");
    Object.assign(img, { src: p.image, alt: `${p.brand} ${p.name}`, loading: "lazy", decoding: "async", draggable: false });
    media.append(img);

    const add = h("button", "kc-add");
    add.type = "button";
    add.dataset.id = p.id;
    const visual = h("span", "kc-add__visual ds-corner");
    visual.append(h("span", "kc-add__icon kc-add__icon--plus", createIcon("plus", { size: 16 })), h("span", "kc-add__icon kc-add__icon--check", createIcon("check", { size: 16 })));
    add.append(visual);
    add.addEventListener("click", () => toggle(p.id));

    // Same order as the mobile catalog card: condition → «Brand Model» on one line (ellipsis if too long) → price.
    const name = h("p", "kc-card__name ds-text-body", h("span", "kc-card__brand", p.brand), " ", h("span", "kc-card__model", p.name));
    name.title = `${p.brand} ${p.name}`;
    const info = h("div", "kc-card__info",
      h("p", "kc-card__condition ds-text-body-s", p.condition),
      name,
      h("p", "kc-card__price ds-text-body", money(p.price)),
    );
    // Photo and text open the product page; the «+» control keeps its own job (selection).
    const open = h("button", "kc-card__open", media, info);
    open.type = "button";
    open.setAttribute("aria-label", `${p.brand} ${p.name}, ${p.condition.toLowerCase()}, ${money(p.price)} — открыть`);
    open.addEventListener("click", () => onOpenProduct?.(p.id));
    const card = h("article", "kc-card", open, add);
    card.dataset.id = p.id;
    card.setAttribute("role", "listitem");
    paintCard(card, p);
    return card;
  }

  function paintCard(card, p = byId.get(card.dataset.id)) {
    const on = selection.has(p.id);
    card.toggleAttribute("data-selected", on);
    const add = card.querySelector(".kc-add");
    add.setAttribute("aria-pressed", String(on));
    add.setAttribute("aria-label", on ? `Убрать из примерки: ${p.brand} ${p.name}` : `Добавить в примерку: ${p.brand} ${p.name}`);
  }

  function toggle(id) {
    const res = selection.toggle(id);
    if (res.ok) {
      const visual = cards.get(id).querySelector(".kc-add__visual");
      visual.classList.remove("is-toggled");
      void visual.offsetWidth;
      visual.classList.add("is-toggled");
    }
    if (!res.ok && res.reason === "limit") {
      showToast(`В примерку — не больше ${selection.limit} лотов. Уберите один, чтобы добавить другой`);
      const card = cards.get(id);
      card.classList.remove("is-refused");
      void card.offsetWidth;
      card.classList.add("is-refused");
    }
  }

  // Called by app.js on every selection change.
  function onSelectionChange(change) {
    for (const card of cards.values()) paintCard(card);
    root.toggleAttribute("data-selection-full", selection.full);
    if (change.type !== "add" || !selection.full) hideToast();
    panel.update(selection.ids, change);
    fittingSheet.update(change);
    root.toggleAttribute("data-panel", selection.size > 0);
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    requestAnimationFrame(() => toast.dataset.state = "open");
    toastTimer = setTimeout(hideToast, 3600);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    toastTimer = null;
    if (toast.hidden) return;
    toast.dataset.state = "closed";
    setTimeout(() => { if (toast.dataset.state === "closed") toast.hidden = true; }, 220);
  }

  // ---------- Sort menu (non-modal popover: no backdrop) ----------
  const menu = h("div", "kc-menu ds-corner");
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const menuItems = SORT_OPTIONS.map((o) => {
    const b = h("button", "kc-menu__item ds-text-body", h("span", null, o.label), h("span", "kc-menu__check", createIcon("check", { size: 20 })));
    b.type = "button";
    b.setAttribute("role", "menuitemradio");
    b.dataset.sort = o.id;
    b.addEventListener("click", () => { state.sort = o.id; closeMenu(); update({ animate: true, scrollTop: true }); });
    return b;
  });
  menu.append(...menuItems);
  sortWrap.append(menu);
  const onOutside = (e) => { if (!menu.contains(e.target) && !sortButton.contains(e.target)) closeMenu(); };
  function openMenu() {
    menu.hidden = false;
    sortButton.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onOutside, true);
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    sortButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside, true);
  }
  sortButton.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));

  // ---------- Filters ----------
  let filtersButton = null;
  let sheet = null;
  loadFiltersIcon().then((svg) => {
    filtersButton = createButton({ label: "Фильтры", variant: "secondary", iconPosition: svg ? "leading" : "none", icon: svg || "", onClick: () => {
      closeMenu();
      sheet = openFilterSheet({
        state, products,
        countFor: (draft) => applyCatalog(products, draft).length,
        onChange: () => update({ animate: true }),
        onClose: () => { sheet = null; },
      });
    } });
    filtersButton.classList.add("kc-filters");
    filtersSlot.append(filtersButton);
    paintFiltersButton();
  });
  const paintFiltersButton = () => {
    if (!filtersButton) return;
    const n = activeFilterChips(state).length;
    filtersButton.querySelector(".ds-button__label").textContent = n ? `Фильтры · ${n}` : "Фильтры";
    filtersButton.setAttribute("aria-label", n ? `Фильтры, активно: ${n}` : "Фильтры");
  };

  // ---------- Search ----------
  input.addEventListener("input", () => { state.query = input.value; update({ scrollTop: true }); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  input.addEventListener("search", () => { state.query = input.value; update({ scrollTop: true }); });
  clearSearch.addEventListener("click", (e) => { e.preventDefault(); input.value = ""; state.query = ""; update({ animate: true }); });

  // ---------- Render ----------
  function update({ animate = false, scrollTop = false } = {}) {
    const list = applyCatalog(products, state);
    grid.replaceChildren(...list.map((p) => cards.get(p.id)));
    if (animate) { grid.classList.remove("is-entering"); void grid.offsetWidth; grid.classList.add("is-entering"); }
    if (scrollTop) scroller.scrollTop = 0;

    for (const b of tabButtons) {
      const on = b.dataset.category === state.category;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    sortLabel.textContent = SORT_OPTIONS.find((o) => o.id === state.sort).label;
    for (const b of menuItems) b.setAttribute("aria-checked", String(b.dataset.sort === state.sort));
    clearSearch.hidden = !state.query;

    const chips = activeFilterChips(state);
    chipsBox.replaceChildren(...chips.map((c) => {
      const chip = h("button", "kc-chip ds-corner ds-text-body-s", h("span", null, c.label), h("span", "kc-chip__x", createIcon("close", { size: 16 })));
      chip.type = "button";
      chip.dataset.corner = "circular";
      chip.setAttribute("aria-label", `Убрать фильтр: ${c.label}`);
      chip.addEventListener("click", () => { c.remove(state); update({ animate: true }); });
      return chip;
    }));
    if (chips.length) chipsBox.append(resetAll);
    meta.toggleAttribute("data-has-chips", chips.length > 0);
    count.textContent = `${list.length} ${lotsWord(list.length)} ${list.length === 1 ? "доступен" : "доступны"} к примерке`;
    paintFiltersButton();

    empty.hidden = list.length > 0;
    if (!list.length) {
      const narrowed = state.query || chips.length;
      const catLabel = CATEGORIES.find((c) => c.id === state.category).label;
      emptyTitle.textContent = narrowed ? "Ничего не нашлось" : `${catLabel} — пока нет лотов`;
      emptyText.textContent = narrowed ? "Попробуйте изменить запрос или фильтры" : "В прототипе пока только сумки";
      emptyAction.replaceChildren(createButton({
        label: narrowed ? "Сбросить поиск и фильтры" : "Показать все лоты", variant: "secondary",
        onClick: () => { input.value = ""; state.query = ""; clearFilters(state); state.category = "all"; update({ animate: true }); },
      }));
    }
  }

  // Next visitor: everything back to the initial state (selection is cleared by app.js).
  function reset() {
    closeMenu();
    fittingSheet.close({ immediate: true });
    sheet?.close({ immediate: true });
    sheet = null;
    hideToast();
    Object.assign(state, createCatalogState());
    input.value = "";
    input.blur();
    update();
    scroller.scrollTop = 0;
  }

  update();
  return { reset, onSelectionChange, get state() { return state; }, scroller, closeOverlays: () => { closeMenu(); sheet?.close({ immediate: true }); }, fittingSheet, panel, closeFittingSheet: () => fittingSheet.close({ immediate: true }) };
}
