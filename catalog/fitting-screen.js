// Минимальный экран «Примерка»: выбранные лоты и возврат в каталог. Оформление заявки на примерку (номер,
// консультант) — следующий шаг, здесь не реализовано.
import { createButton } from "../design-system/components/button/button.js?v=e0e8b6842915";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=e0e8b6842915";
import { money, lotsWord } from "./filters.js?v=e0e8b6842915";

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

  const title = h("h1", "kf-title", "Примерка");
  title.id = "fittingTitle";
  const sub = h("p", "kf-sub ds-text-body");
  const list = h("ul", "kf-list");
  const note = h("p", "kf-note ds-text-body", "Оформление заявки на примерку появится на следующем шаге прототипа");
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
      const remove = createTextAction({ label: "Убрать", onClick: () => { selection.toggle(id); if (!selection.size) onBack(); else render(); } });
      remove.setAttribute("aria-label", `Убрать из примерки: ${p.brand} ${p.name}`);
      return h("li", "kf-item",
        h("div", "kf-item__media ds-corner", img),
        h("div", "kf-item__info",
          h("p", "ds-text-body kf-item__brand", p.brand),
          h("p", "ds-text-body kf-item__model", p.name),
          h("p", "ds-text-body-s kf-item__meta", `${p.condition} · ${money(p.price)}`),
          h("p", "ds-text-body-s kf-item__meta", `Артикул ${p.article}`)),
        remove);
    }));
  }
  return { render };
}
