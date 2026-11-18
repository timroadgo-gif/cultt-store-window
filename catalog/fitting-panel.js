// Панель примерки: плавающая полоса внизу экрана каталога. Скрыта, пока ничего не выбрано; появляется с первым
// лотом, обновляет счетчик и миниатюры, уходит, когда выбор пуст. Каталог добавляет снизу отступ под нее
// (data-panel на экране), поэтому она не закрывает карточки и их кнопки.
import { createButton } from "../design-system/components/button/button.js?v=431dfa42b9fe";
import { pill } from "./ui.js?v=431dfa42b9fe";

export function createFittingPanel({ byId, limit, onOpen }) {
  const el = document.createElement("section");
  el.className = "kc-panel ds-corner";
  el.setAttribute("aria-label", "Примерка");
  el.dataset.state = "hidden";
  el.inert = true;

  // «Примерка · N из 5»: only N changes, with a short fade/slide (aria-live reads the whole line).
  const title = document.createElement("p");
  title.className = "kc-panel__title";
  title.setAttribute("aria-live", "polite");
  const countEl = document.createElement("span");
  countEl.className = "kc-panel__count";
  title.append("Примерка · ", countEl, ` из ${limit}`);
  const thumbs = document.createElement("ul");
  thumbs.className = "kc-panel__thumbs";
  thumbs.setAttribute("aria-label", "Выбранные лоты");
  const cta = createButton({ label: "Открыть примерку", variant: "primary", onClick: () => onOpen() });
  cta.classList.add("kc-panel__cta");
  pill(cta);
  const lead = document.createElement("div");
  lead.className = "kc-panel__lead";
  lead.append(title, thumbs);
  el.append(lead, cta);

  const thumbNodes = new Map();
  const thumb = (id) => {
    const p = byId.get(id);
    const li = document.createElement("li");
    li.className = "kc-panel__thumb ds-corner";
    const img = document.createElement("img");
    Object.assign(img, { src: p.image, alt: `${p.brand} ${p.name}`, draggable: false });
    li.append(img);
    return li;
  };

  function update(ids, change = {}) {
    const visible = ids.length > 0;
    if (visible && countEl.textContent !== String(ids.length)) {
      const animate = countEl.textContent !== "" && el.dataset.state === "shown";
      countEl.textContent = String(ids.length);
      if (animate) {
        countEl.classList.remove("is-changing");
        void countEl.offsetWidth;
        countEl.classList.add("is-changing");
      }
    }
    for (const [id, node] of thumbNodes) if (!ids.includes(id)) { node.remove(); thumbNodes.delete(id); }
    ids.forEach((id, i) => {
      let node = thumbNodes.get(id);
      if (!node) {
        node = thumb(id);
        if (change.type === "add" && change.id === id) node.classList.add("is-new");
        thumbNodes.set(id, node);
      }
      if (thumbs.children[i] !== node) thumbs.insertBefore(node, thumbs.children[i] ?? null);
    });
    if (visible && el.dataset.state !== "shown") {
      el.dataset.state = "shown";
      el.inert = false;
    } else if (!visible && el.dataset.state === "shown") {
      el.dataset.state = "hidden";
      el.inert = true;
    }
  }

  update([]);
  return { el, update };
}
