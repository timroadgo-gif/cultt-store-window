// Фильтры каталога — модальная панель справа (iPad landscape) над ModalBackdrop UI Kit.
// Изменения применяются сразу (сетка за подложкой обновляется), кнопка внизу показывает число лотов и закрывает
// панель. Закрытие: кнопка, тап по подложке, Escape.
import { createModalBackdrop, openBackdrop, closeBackdrop } from "../design-system/backdrop/backdrop.js?v=e0e8b6842915";
import { createButton } from "../design-system/components/button/button.js?v=e0e8b6842915";
import { createCheckbox } from "../design-system/components/checkbox/checkbox.js?v=e0e8b6842915";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=e0e8b6842915";
import { createIcon } from "../design-system/icons/icon.js?v=e0e8b6842915";
import { CONDITIONS, PRICE_LIMITS, brandsOf, clearFilters, lotsWord, money } from "./filters.js?v=e0e8b6842915";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

export function openFilterSheet({ state, products, countFor, onChange, onClose }) {
  const backdrop = createModalBackdrop({ onDismiss: () => close() });
  const panel = h("aside", "kc-sheet ds-corner");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "kcSheetTitle");

  const title = h("h2", "kc-sheet__title ds-text-heading-l", "Фильтры");
  title.id = "kcSheetTitle";
  const reset = createTextAction({ label: "Сбросить", onClick: () => { clearFilters(state); changed(); rebuild(); } });
  const head = h("div", "kc-sheet__head", title, reset);

  const body = h("div", "kc-sheet__body");
  const footer = h("div", "kc-sheet__footer");
  const show = createButton({ label: "Показать", width: "fill", onClick: () => close() });
  footer.append(show);
  panel.append(head, body, footer);

  const section = (label, ...content) => h("section", "kc-sheet__section", h("h3", "kc-sheet__label ds-text-overline", label), ...content);

  function rebuild() {
    const brands = h("div", "kc-sheet__checks", ...brandsOf(products).map((b) => createCheckbox({
      label: b, checked: state.brands.has(b),
      onChange: (on) => { on ? state.brands.add(b) : state.brands.delete(b); changed(); },
    })));
    const conditions = h("div", "kc-sheet__checks", ...CONDITIONS.map((c) => createCheckbox({
      label: c, checked: state.conditions.has(c),
      onChange: (on) => { on ? state.conditions.add(c) : state.conditions.delete(c); changed(); },
    })));
    // Price: one choice («Любая» or «до …»), rows with the UI Kit check icon, as in the mobile catalog's choice popup.
    const prices = h("div", "kc-sheet__options");
    const options = [{ value: null, label: "Любая" }, ...PRICE_LIMITS.map((v) => ({ value: v, label: `до ${money(v)}` }))];
    const paintPrices = () => prices.querySelectorAll(".kc-option").forEach((b) => b.setAttribute("aria-checked", String(String(state.priceMax) === b.dataset.value)));
    for (const o of options) {
      const b = h("button", "kc-option ds-text-body", h("span", null, o.label), h("span", "kc-option__check", createIcon("check", { size: 20 })));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.value = String(o.value);
      b.addEventListener("click", () => { state.priceMax = o.value; paintPrices(); changed(); });
      prices.append(b);
    }
    prices.setAttribute("role", "radiogroup");
    prices.setAttribute("aria-label", "Цена");
    paintPrices();
    body.replaceChildren(section("Бренд", brands), section("Состояние", conditions), section("Цена", prices));
  }

  function paintCount() {
    const n = countFor(state);
    show.querySelector(".ds-button__label").textContent = n ? `Показать ${n} ${lotsWord(n)}` : "Нет подходящих лотов";
  }
  function changed() { onChange(); paintCount(); }

  const onKey = (e) => { if (e.key === "Escape") close(); };
  let closed = false;
  function close({ immediate = false } = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    closeBackdrop(backdrop);
    panel.dataset.state = "closing";
    const done = () => { backdrop.remove(); panel.remove(); };
    if (immediate) done(); else setTimeout(done, 320);
    onClose?.();
  }

  rebuild();
  paintCount();
  document.body.append(backdrop, panel);
  openBackdrop(backdrop);
  void panel.offsetWidth;
  panel.dataset.state = "open";
  document.addEventListener("keydown", onKey);
  return { close, el: panel };
}
