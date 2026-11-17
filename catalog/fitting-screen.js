// Заглушка следующего шага после «Заказать на примерку»: выбранные лоты (тот же selection, без изменений) и
// возврат в каталог. Подтверждение заявки, номер и передача консультанту здесь не реализованы.
import { createButton } from "../design-system/components/button/button.js?v=c296ea813e20";
import { money, lotsWord } from "./filters.js?v=c296ea813e20";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

export function mountFitting(root, { byId, selection, onBack }) {
  const logo = h("div", "brand brand--compact", h("span", "brand__logo"));
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "THE CULTT");
  const back = createButton({ label: "К каталогу", variant: "secondary", iconPosition: "leading", icon: "arrow-left", onClick: onBack });
  const bar = h("header", "kf-bar", logo, back);

  const title = h("h1", "kf-title", "Заявка на примерку");
  title.id = "fittingTitle";
  const sub = h("p", "kf-sub ds-text-body");
  const list = h("ul", "kf-list");
  const note = h("p", "kf-note ds-text-body", "Подтверждение заявки и передача консультанту — следующий шаг прототипа");
  const body = h("div", "kf-body", h("div", "kf-head", title, sub), list, note);
  body.dataset.scrollReset = "";
  root.append(bar, body);

  function render() {
    const ids = selection.ids;
    sub.textContent = `${ids.length} ${lotsWord(ids.length)} из ${selection.limit}`;
    list.replaceChildren(...ids.map((id) => {
      const p = byId.get(id);
      const img = h("img", "kf-item__image");
      Object.assign(img, { src: p.image, alt: "", draggable: false });
      return h("li", "kf-item",
        h("div", "kf-item__media ds-corner", img),
        h("div", "kf-item__info",
          h("p", "ds-text-body kf-item__brand", p.brand),
          h("p", "ds-text-body kf-item__model", p.name),
          h("p", "ds-text-body-s kf-item__meta", `${p.condition} · ${money(p.price)}`),
          h("p", "ds-text-body-s kf-item__meta", `Артикул ${p.article}`)));
    }));
  }
  return { render };
}
