// Каталог витрины (iPad, landscape): шапка (логотип, поиск, фильтры), категории + сортировка, активные фильтры и
// число лотов, сетка карточек с выбором на примерку, панель примерки. Состояние каталога — в памяти, сбрасывается
// reset() (по бездействию). Выбор на примерку живёт в selection и не сбрасывается при поиске / фильтрах / сортировке.
import { createButton } from "../design-system/components/button/button.js?v=a55d3567b850";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=a55d3567b850";
import { createIcon } from "../design-system/icons/icon.js?v=a55d3567b850";
import {
  CATEGORIES, FILTER_SETS, SORT_OPTIONS, applyCatalog, activeFilterChips, assignFilters, clearFilters, createCatalogState, createFilters, lotsWord, money,
} from "./filters.js?v=a55d3567b850";
import { openFilterSheet } from "./filter-sheet.js?v=a55d3567b850";
import { pill } from "./ui.js?v=a55d3567b850";
import { createFittingPanel } from "./fitting-panel.js?v=a55d3567b850";
import { createFittingSheet } from "./fitting-sheet.js?v=a55d3567b850";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

const FILTERS_ICON_URL = "assets/filters.svg";
const SORT_ICON_URL = "assets/sort.svg";
const iconCache = new Map();
const loadIcon = (url) => { if (!iconCache.has(url)) iconCache.set(url, fetch(url).then((r) => r.text()).catch(() => "")); return iconCache.get(url); };
const loadFiltersIcon = () => loadIcon(FILTERS_ICON_URL);

export function mountCatalog(root, { products, selection, network, availability, onSubmitFitting, onOpenProduct, onAddMore }) {
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
  // Sort: UI Kit secondary button = sort arrows (same icon as the mobile catalog's sort chip) + label + chevron.
  // Sort: one compact control = sort arrows + the current order (Shopify / iOS menu-button pattern), no chevron;
  // the arrows say «sorting», the label says which. Same neutral surface and height as Filters and the search field.
  const sortButton = createButton({ label: "Сначала новые", variant: "secondary" });
  sortButton.classList.add("kc-sort", "kc-tool", "kiosk-neutral");
  loadIcon(SORT_ICON_URL).then((svg) => {
    if (!svg) return;
    const lead = h("span", "ds-button__icon kc-sort__icon");
    lead.setAttribute("aria-hidden", "true");
    lead.innerHTML = svg;
    sortButton.prepend(lead);
    sortButton.dataset.iconPosition = "leading";
  });
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
  // Empty result: ONE component, content and actions by context (emptyContent below). Product data is local and
  // synchronous, so an empty list here always means a completed search / filtering returned nothing — there is no
  // loading state, and the connection does not affect it (offline is shown by the offline notice, not here).
  const empty = h("div", "kc-empty");
  empty.hidden = true;
  empty.setAttribute("role", "status");
  const emptyIcon = h("span", "kc-empty__icon", createIcon("search", { size: 24 }));
  emptyIcon.setAttribute("aria-hidden", "true");
  const emptyTitle = h("p", "kc-empty__title");
  const emptyText = h("p", "kc-empty__text");
  const emptyAction = h("div", "kc-empty__actions");
  empty.append(emptyIcon, emptyTitle, emptyText, emptyAction);
  const scroller = h("div", "kc-scroll", meta, grid, empty);
  scroller.dataset.scrollReset = "";

  const toast = h("div", "kc-toast ds-corner ds-text-body");
  toast.setAttribute("role", "status");
  toast.hidden = true;

  // «Открыть примерку» → bottom sheet over the catalog; it reads and edits the same selection.
  const fittingSheet = createFittingSheet({ byId, selection, network, availability, onSubmit: (ids) => onSubmitFitting?.(ids), onAddMore: () => onAddMore?.() });
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
        // count = what the catalog would show: current category + search, with the draft filters
        countFor: (draft) => applyCatalog(products, { ...state, ...draft }).length,
        onApply: (draft) => { assignFilters(state, draft); update({ animate: true, scrollTop: true }); },
        onClose: () => { sheet = null; },
      });
    } });
    filtersButton.classList.add("kc-filters", "kc-tool", "kiosk-neutral");
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
    sortButton.setAttribute("aria-label", `Сортировка: ${sortLabel.textContent}`);
    for (const b of menuItems) b.setAttribute("aria-checked", String(b.dataset.sort === state.sort));
    clearSearch.hidden = !state.query;

    const chips = activeFilterChips(state);
    chipsBox.replaceChildren(...chips.map((c) => {
      const chip = h("button", "kc-chip ds-corner ds-text-body-s", h("span", "kc-chip__label", c.label), h("span", "kc-chip__x", createIcon("close", { size: 16 })));
      chip.type = "button";
      chip.dataset.corner = "circular";
      chip.setAttribute("aria-label", `Убрать фильтр: ${c.label}`);
      chip.addEventListener("click", () => { c.remove(state); update({ animate: true }); });
      return chip;
    }));
    if (chips.length) chipsBox.append(resetAll);
    meta.toggleAttribute("data-has-chips", chips.length > 0);
    count.textContent = list.length ? `${list.length} ${lotsWord(list.length)} ${list.length === 1 ? "доступен" : "доступны"} к примерке` : `0 ${lotsWord(0)}`;
    paintFiltersButton();

    empty.hidden = list.length > 0;
    scroller.toggleAttribute("data-empty", !list.length);
    if (!list.length) paintEmpty(emptyContent(chips.length > 0));
  }

  // ---------- Empty result ----------
  // «Показать все …» opens the current category without search / filters (sort and the fitting selection stay);
  // a category with no lots at all in the catalogue falls back to «Все».
  const SHOW_ALL = { all: "Показать все лоты", bags: "Показать все сумки", shoes: "Показать всю обувь", jewelry: "Показать все украшения", watches: "Показать все часы", accessories: "Показать все аксессуары" };
  const hasLots = (category) => products.some((p) => p.availability === "available" && (category === "all" || p.category === category));
  const clearQuery = () => { input.value = ""; state.query = ""; };
  function emptyContent(hasFilters) {
    const hasQuery = !!state.query.trim();
    const target = hasLots(state.category) ? state.category : "all";
    const showAll = { label: SHOW_ALL[target], run: () => { clearQuery(); clearFilters(state); state.category = target; } };
    if (hasQuery && hasFilters) return {
      kind: "search-filters", title: "Ничего не найдено", text: "Попробуйте изменить запрос или фильтры.",
      primary: { label: "Сбросить поиск и фильтры", run: () => { clearQuery(); clearFilters(state); } }, secondary: showAll,
    };
    if (hasQuery) return {
      kind: "search", title: "Ничего не найдено", text: "Попробуйте изменить запрос или посмотрите другие товары.",
      primary: { label: "Очистить поиск", run: clearQuery }, secondary: showAll,
    };
    if (hasFilters) return {
      kind: "filters", title: "По выбранным фильтрам ничего не найдено", text: "Попробуйте изменить параметры поиска или сбросить фильтры.",
      primary: { label: "Сбросить фильтры", run: () => clearFilters(state) }, secondary: showAll,
    };
    // No search, no filters: the category itself has no lots (the prototype data has bags only).
    const catLabel = CATEGORIES.find((c) => c.id === state.category).label;
    return {
      kind: "category", title: `${catLabel} — пока нет лотов`, text: "Загляните в другие категории или спросите консультанта.",
      primary: { label: "Показать все лоты", run: () => { state.category = "all"; } }, secondary: null,
    };
  }
  function paintEmpty(c) {
    empty.dataset.kind = c.kind;
    emptyTitle.textContent = c.title;
    emptyText.textContent = c.text;
    const act = (a, variant) => {
      const b = pill(createButton({ label: a.label, variant, onClick: () => { a.run(); update({ animate: true, scrollTop: true }); } }));
      if (variant === "secondary") b.classList.add("kiosk-neutral");
      b.classList.add("kc-empty__action");
      return b;
    };
    emptyAction.replaceChildren(act(c.primary, "primary"), ...(c.secondary ? [act(c.secondary, "secondary")] : []));
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
  // Automated checks only: apply filters exactly as the filters panel's «Показать» does.
  function applyFilters(f) {
    const next = createFilters();
    for (const k of FILTER_SETS) if (f[k]) next[k] = new Set(f[k]);
    if ("priceMin" in f) next.priceMin = f.priceMin;
    if ("priceMax" in f) next.priceMax = f.priceMax;
    assignFilters(state, next);
    update({ animate: true, scrollTop: true });
  }
  return { reset, onSelectionChange, applyFilters, get state() { return state; }, get empty() { return empty.hidden ? null : { kind: empty.dataset.kind, title: emptyTitle.textContent, text: emptyText.textContent, actions: [...emptyAction.children].map((b) => b.textContent.trim()), count: count.textContent }; }, scroller, header: top, closeOverlays: () => { closeMenu(); sheet?.close({ immediate: true }); }, fittingSheet, panel, closeFittingSheet: () => fittingSheet.close({ immediate: true }) };
}
