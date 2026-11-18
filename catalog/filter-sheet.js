// Фильтры каталога — боковая панель справа на всю высоту, по образцу фильтров сайта THE CULTT (замеры с thecultt.com,
// 2026-11-17: фон панели grey-1, группы — белые карточки радиус 12, строка 55 px с отступом 16, текст 16/500, чипы
// состояния grey-1 34 px радиус 24, внизу «Показать (N)»).
//   Главный экран: Тип › · Бренд › / Модель › · Цена (два ползунка + «От» / «До») · Цвет › · Состояние (чипы).
//   Вложенный экран внутри той же панели: «‹ Бренд», поиск, «Чаще всего ищут», список по алфавиту, чекбоксы,
//   внизу «Применить (N)» — возвращает на главный экран. Тип, Модель и Цвет — тот же экран (поиск, если вариантов > 8).
// Изменения копятся в черновике: каталог меняется только по «Показать (N)». Закрытие крестиком, тапом по подложке
// или Escape отменяет черновик; при следующем открытии панель показывает примененные фильтры.
import { createModalBackdrop, openBackdrop, closeBackdrop } from "../design-system/backdrop/backdrop.js?v=c4dc60a7b65c";
import { createButton } from "../design-system/components/button/button.js?v=c4dc60a7b65c";
import { createCheckbox } from "../design-system/components/checkbox/checkbox.js?v=c4dc60a7b65c";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=c4dc60a7b65c";
import { createIcon } from "../design-system/icons/icon.js?v=c4dc60a7b65c";
import { pill } from "./ui.js?v=c4dc60a7b65c";
import {
  CONDITIONS, POPULAR_BRANDS, brandsOf, typesOf, colorsOf, modelsOf, priceBounds,
  copyFilters, createFilters, FILTER_SETS, money,
} from "./filters.js?v=c4dc60a7b65c";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ё/g, "е").trim();
const digits = (s) => Number(String(s).replace(/\D/g, "")) || 0;
const bare = (n) => new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, " ");
const PRICE_STEP = 1000;

const LISTS = {
  types: { title: "Тип", options: typesOf },
  brands: { title: "Бренд", options: brandsOf },
  models: { title: "Модель", options: (products, draft) => modelsOf(draft.brands.size ? products.filter((p) => draft.brands.has(p.brand)) : products) },
  colors: { title: "Цвет", options: colorsOf },
};

export function openFilterSheet({ state, products, countFor, onApply, onClose }) {
  const draft = copyFilters(state);
  const bounds = priceBounds(products);
  const backdrop = createModalBackdrop({ onDismiss: () => close() });
  const panel = h("aside", "kf");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "kfTitle");

  // Header: leading control (close on the main view, back on a nested one) · centred title · reset (main only).
  const lead = h("div", "kf__lead");
  const title = h("h2", "kf__title");
  title.id = "kfTitle";
  const trail = h("div", "kf__trail");
  const head = h("header", "kf__head", lead, title, trail);
  const body = h("div", "kf__body");
  const action = pill(createButton({ label: "Показать", width: "fill", onClick: () => onAction() }));
  action.classList.add("kf__action");
  const foot = h("footer", "kf__foot", action);
  panel.append(head, body, foot);

  let view = "main"; // or a LISTS key
  let onAction = () => {};

  const iconButton = (icon, label, fn) => {
    const b = createButton({ variant: "secondary", iconPosition: "only", icon, ariaLabel: label, onClick: fn });
    b.classList.add("kc-tool", "kf__icon-btn");
    b.dataset.corner = "circular";
    return b;
  };
  const paintAction = () => {
    action.querySelector(".ds-button__label").textContent = `${view === "main" ? "Показать" : "Применить"} (${bare(countFor(draft))})`;
  };
  const activeCount = () => FILTER_SETS.reduce((a, k) => a + draft[k].size, 0) + (draft.priceMin !== null || draft.priceMax !== null ? 1 : 0);
  const summary = (key) => {
    const v = [...draft[key]];
    return v.length === 0 ? "" : v.length <= 2 ? v.join(", ") : `${v.slice(0, 2).join(", ")} +${v.length - 2}`;
  };

  // ---------- Main view ----------
  function row(key) {
    const value = h("span", "kf-row__value ds-text-body", summary(key));
    const b = h("button", "kf-row", h("span", "kf-row__label", LISTS[key].title), value, h("span", "kf-row__chevron", createIcon("chevron-right", { size: 20 })));
    b.type = "button";
    b.dataset.filter = key;
    b.addEventListener("click", () => show(key));
    return b;
  }
  const group = (...children) => h("section", "kf-group ds-corner", ...children);

  function priceGroup() {
    const range = bounds.max - bounds.min || 1;
    const lo = h("input", "kf-range__input kf-range__input--min");
    const hi = h("input", "kf-range__input kf-range__input--max");
    for (const [inp, v, label] of [[lo, draft.priceMin ?? bounds.min, "Минимальная цена"], [hi, draft.priceMax ?? bounds.max, "Максимальная цена"]]) {
      Object.assign(inp, { type: "range", min: String(bounds.min), max: String(bounds.max), step: String(PRICE_STEP), value: String(v) });
      inp.setAttribute("aria-label", label);
    }
    const fill = h("span", "kf-range__fill");
    const slider = h("div", "kf-range", h("span", "kf-range__track"), fill, lo, hi);

    const field = (label) => {
      const input = h("input", "ds-field__input ds-text-input kf-price__input");
      Object.assign(input, { type: "text", inputMode: "numeric", autocomplete: "off" });
      input.setAttribute("aria-label", `Цена ${label.toLowerCase()}, рублей`);
      const root = h("label", "ds-field ds-corner kf-price__field", h("span", "ds-field__content", h("span", "ds-field__label ds-text-caption", label), input));
      root.dataset.kind = "text";
      return { root, input };
    };
    const from = field("От");
    const to = field("До");

    const paint = () => {
      const a = Number(lo.value), b = Number(hi.value);
      fill.style.left = `${((a - bounds.min) / range) * 100}%`;
      fill.style.right = `${100 - ((b - bounds.min) / range) * 100}%`;
      if (document.activeElement !== from.input) from.input.value = money(a);
      if (document.activeElement !== to.input) to.input.value = money(b);
    };
    const commit = () => {
      const a = Number(lo.value), b = Number(hi.value);
      draft.priceMin = a <= bounds.min ? null : a;
      draft.priceMax = b >= bounds.max ? null : b;
      paint();
      paintAction();
    };
    lo.addEventListener("input", () => { if (Number(lo.value) > Number(hi.value) - PRICE_STEP) lo.value = String(Number(hi.value) - PRICE_STEP); commit(); });
    hi.addEventListener("input", () => { if (Number(hi.value) < Number(lo.value) + PRICE_STEP) hi.value = String(Number(lo.value) + PRICE_STEP); commit(); });
    const bindField = (f, slot, other, isMin) => {
      f.input.addEventListener("focus", () => { f.input.value = String(digits(f.input.value)); f.input.select(); });
      const apply = () => {
        let v = Math.round(digits(f.input.value) / PRICE_STEP) * PRICE_STEP;
        v = Math.min(bounds.max, Math.max(bounds.min, v));
        v = isMin ? Math.min(v, Number(other.value) - PRICE_STEP) : Math.max(v, Number(other.value) + PRICE_STEP);
        slot.value = String(v);
        f.input.blur();
        commit();
      };
      f.input.addEventListener("change", apply);
      f.input.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
      f.input.addEventListener("blur", () => paint());
    };
    bindField(from, lo, hi, true);
    bindField(to, hi, lo, false);
    paint();
    return group(h("h3", "kf-group__title", "Цена"), slider, h("div", "kf-price", from.root, to.root));
  }

  function conditionGroup() {
    const chips = CONDITIONS.map((c) => {
      const b = h("button", "kf-chip ds-corner", c);
      b.type = "button";
      b.dataset.corner = "circular";
      b.setAttribute("aria-pressed", String(draft.conditions.has(c)));
      b.addEventListener("click", () => {
        draft.conditions.has(c) ? draft.conditions.delete(c) : draft.conditions.add(c);
        b.setAttribute("aria-pressed", String(draft.conditions.has(c)));
        paintAction();
        paintReset();
      });
      return b;
    });
    return group(h("h3", "kf-group__title", "Состояние"), h("div", "kf-chips", ...chips));
  }

  let paintReset = () => {};
  function renderMain() {
    title.textContent = "Фильтры";
    lead.replaceChildren(iconButton("close", "Закрыть фильтры", () => close()));
    const reset = createTextAction({ label: "Сбросить", onClick: () => { Object.assign(draft, createFilters()); show("main"); } });
    reset.classList.add("kf__reset");
    paintReset = () => { reset.hidden = activeCount() === 0; };
    paintReset();
    trail.replaceChildren(reset);
    body.replaceChildren(
      group(row("types")),
      group(row("brands"), h("hr", "kf-group__rule"), row("models")),
      priceGroup(),
      group(row("colors")),
      conditionGroup(),
    );
    onAction = () => apply();
  }

  // ---------- Nested selection view ----------
  function renderList(key) {
    const cfg = LISTS[key];
    title.textContent = cfg.title;
    lead.replaceChildren(iconButton("chevron-left", "Назад к фильтрам", () => show("main")));
    trail.replaceChildren();
    paintReset = () => {};
    const options = cfg.options(products, draft);
    const withSearch = key === "brands" || key === "models" || options.length > 8;
    const list = h("div", "kf-list");
    const option = (value) => {
      const c = createCheckbox({ label: value, checked: draft[key].has(value), onChange: (on) => { on ? draft[key].add(value) : draft[key].delete(value); paintAction(); } });
      c.classList.add("kf-option");
      c.dataset.value = value;
      return c;
    };
    const paintList = (q = "") => {
      const nq = norm(q);
      const visible = options.filter((v) => !nq || norm(v).includes(nq));
      const items = [];
      if (key === "brands" && !nq) {
        const popular = POPULAR_BRANDS.filter((b) => options.includes(b));
        if (popular.length) items.push(h("p", "kf-list__caption", "Чаще всего ищут"), ...popular.map(option));
      }
      if (key === "brands") {
        let letter = null;
        for (const v of visible) {
          const l = v[0].toUpperCase();
          if (l !== letter) { letter = l; items.push(h("p", "kf-list__letter", l)); }
          items.push(option(v));
        }
      } else items.push(...visible.map(option));
      if (!visible.length) items.push(h("p", "kf-list__empty ds-text-body", "Ничего не найдено"));
      list.replaceChildren(...items);
    };
    const parts = [];
    if (withSearch) {
      const input = h("input", "ds-field__input ds-text-input kf-search__input");
      Object.assign(input, { type: "search", placeholder: "Поиск", autocomplete: "off", enterKeyHint: "search", spellcheck: false });
      input.setAttribute("aria-label", `Поиск: ${cfg.title.toLowerCase()}`);
      input.addEventListener("input", () => paintList(input.value));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      const search = h("label", "ds-field ds-corner kf-search", h("span", "kf-search__icon", createIcon("search", { size: 20 })), h("span", "ds-field__content", input));
      search.dataset.kind = "text";
      parts.push(search);
    }
    paintList();
    body.replaceChildren(...parts, list);
    onAction = () => show("main");
  }

  function show(next) {
    const forward = next !== "main";
    view = next;
    if (next === "main") renderMain(); else renderList(next);
    body.scrollTop = 0;
    panel.dataset.view = next;
    paintAction();
    if (panel.dataset.state === "open") {
      body.classList.remove("is-forward", "is-back");
      void body.offsetWidth;
      body.classList.add(forward ? "is-forward" : "is-back");
    }
  }

  // ---------- Open / apply / close ----------
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); view === "main" ? close() : show("main"); } };
  let closed = false;
  function apply() {
    onApply(copyFilters(draft));
    close();
  }
  function close({ immediate = false } = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    closeBackdrop(backdrop);
    panel.dataset.state = "closing";
    const done = () => { backdrop.remove(); panel.remove(); };
    if (immediate) done(); else setTimeout(done, 300);
    onClose?.();
  }

  show("main");
  document.body.append(backdrop, panel);
  openBackdrop(backdrop);
  void panel.offsetWidth;
  panel.dataset.state = "open";
  document.addEventListener("keydown", onKey);
  return { close, el: panel, get view() { return view; }, get draft() { return copyFilters(draft); } };
}
