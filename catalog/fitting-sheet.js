// Шторка «Примерка» (iPad landscape): модальная нижняя шторка над каталогом, одно положение, без «ручки».
// Источник данных — общий selection каталога (тот же объект, что у карточек и панели примерки); своего списка нет.
//   • 5 позиций: выбранные лоты в порядке выбора + тихие свободные места (светлая подложка, маленький «+»).
//   • «×» на карточке убирает лот сразу; карточка гаснет, оставшиеся плавно сдвигаются (FLIP на transform).
//   • Последний лот убран → шторка закрывается, панель примерки в каталоге скрывается (selection пуст).
//   • «Добавить еще» закрывает шторку (выбор сохраняется); при 5 из 5 скрыта.
//   • «Заказать на примерку» → onSubmit (следующий шаг), выбор не очищается.
// Подложка — ModalBackdrop UI Kit (легкое затемнение + небольшой размытие, слой целиком плавно появляется).
import { createModalBackdrop, openBackdrop, closeBackdrop } from "../design-system/backdrop/backdrop.js?v=00dd94ce5b19";
import { createButton, setButtonState } from "../design-system/components/button/button.js?v=00dd94ce5b19";
import { createIcon } from "../design-system/icons/icon.js?v=00dd94ce5b19";
import { money } from "./filters.js?v=00dd94ce5b19";
import { pill } from "./ui.js?v=00dd94ce5b19";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};

const OPEN_MS = 420;
const CLOSE_MS = 320;
const REMOVE_FADE_MS = 160;
const MOVE_MS = 280;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createFittingSheet({ byId, selection, onAddMore, onSubmit }) {
  let backdrop = null;
  let el = null;
  let refs = null;
  let closeTimer = null;
  const itemNodes = new Map();
  const onKey = (e) => { if (e.key === "Escape") close(); };

  function build() {
    const title = h("h2", "kfs__title");
    title.id = "kfsTitle";
    const closeBtn = createButton({ variant: "secondary", iconPosition: "only", icon: "close", ariaLabel: "Закрыть примерку", onClick: () => close() });
    closeBtn.classList.add("kfs__close", "kc-tool");
    closeBtn.dataset.corner = "circular";
    const slots = h("ul", "kfs__slots");
    slots.setAttribute("aria-label", "Выбранные лоты");

    const addMore = pill(createButton({ label: "Добавить еще", variant: "secondary", onClick: () => { close(); onAddMore?.(); } }));
    addMore.classList.add("kfs__add-more", "kiosk-neutral");
    const submit = pill(createButton({ label: "Заказать на примерку", variant: "primary", width: "fill", onClick: () => submitRequest() }));
    submit.classList.add("kfs__submit");
    const note = h("p", "kfs__note", "Принесем со склада — обычно это несколько минут");
    const primary = h("div", "kfs__primary", submit, note);
    const actions = h("div", "kfs__actions", addMore, primary);

    const sheet = h("section", "kfs ds-corner", h("header", "kfs__head", title, closeBtn), slots, actions);
    sheet.dataset.cornerEdges = "top";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "kfsTitle");
    refs = { title, slots, addMore, closeBtn, submit };
    return sheet;
  }

  function itemNode(id) {
    const p = byId.get(id);
    const img = h("img", "kfs-item__image");
    Object.assign(img, { src: p.image, alt: `${p.brand} ${p.name}`, draggable: false, decoding: "async" });
    const remove = h("button", "kfs-item__remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Убрать из примерки: ${p.brand} ${p.name}`);
    remove.append(h("span", "kfs-item__remove-visual ds-corner", createIcon("close", { size: 16 })));
    remove.addEventListener("click", () => removeItem(id));
    const node = h("li", "kfs-item",
      h("div", "kfs-item__media ds-corner", img, remove),
      // Same text block as the catalog card (kc-card__*): condition → «Brand Model» on one line → price.
      h("div", "kc-card__info kfs-item__info",
        h("p", "kc-card__condition ds-text-body-s", p.condition),
        h("p", "kc-card__name ds-text-body", h("span", "kc-card__brand", p.brand), " ", h("span", "kc-card__model", p.name)),
        h("p", "kc-card__price ds-text-body", money(p.price))));
    node.dataset.id = id;
    return node;
  }

  function emptyNode() {
    const b = h("button", "kfs-empty__slot ds-corner", h("span", "kfs-empty__icon", createIcon("plus", { size: 20 })));
    b.type = "button";
    b.setAttribute("aria-label", "Свободное место — добавить лот из каталога");
    b.addEventListener("click", () => { close(); onAddMore?.(); });
    const li = h("li", "kfs-empty", b);
    li.dataset.empty = "";
    return li;
  }

  // Reconcile the 5 positions with the shared selection, keeping existing nodes (no full re-render).
  function render() {
    if (!el) return;
    const ids = selection.ids;
    refs.title.textContent = `Примерка · ${ids.length} из ${selection.limit}`;
    refs.addMore.hidden = ids.length >= selection.limit;
    el.toggleAttribute("data-full", ids.length >= selection.limit);
    for (const [id, node] of itemNodes) if (!ids.includes(id)) { node.remove(); itemNodes.delete(id); }
    const wanted = ids.map((id) => {
      if (!itemNodes.has(id)) itemNodes.set(id, itemNode(id));
      return itemNodes.get(id);
    });
    const empties = [...refs.slots.querySelectorAll("[data-empty]")];
    while (empties.length < selection.limit - ids.length) empties.push(emptyNode());
    empties.splice(selection.limit - ids.length).forEach((n) => n.remove());
    [...wanted, ...empties].forEach((node, i) => {
      if (refs.slots.children[i] !== node) refs.slots.insertBefore(node, refs.slots.children[i] ?? null);
    });
  }

  // FLIP: remember positions, apply the new layout, animate every moved node from its old place.
  function renderAnimated() {
    const before = new Map([...refs.slots.children].map((n) => [n, n.getBoundingClientRect()]));
    render();
    if (reducedMotion()) return;
    for (const node of refs.slots.children) {
      const old = before.get(node);
      if (!old) { node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: "ease-out" }); continue; }
      const now = node.getBoundingClientRect();
      const dx = old.left - now.left;
      if (Math.abs(dx) < 0.5) continue;
      node.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: MOVE_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
    }
  }

  function removeItem(id) {
    const node = itemNodes.get(id);
    if (!node || node.dataset.removing) return;
    node.dataset.removing = "";
    const finish = () => {
      selection.toggle(id); // shared state: catalog cards + panel update through onSelectionChange
      if (!selection.size) close();
    };
    if (reducedMotion()) return finish();
    node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REMOVE_FADE_MS, easing: "ease-in", fill: "forwards" }).finished.then(finish, finish);
  }

  // «Заказать на примерку»: one request at a time (the button turns into the kit loading state); the confirmation is
  // shown by onSubmit only after the (mock) submission resolved. On failure the button comes back.
  let submitting = false;
  async function submitRequest() {
    if (submitting || !selection.size) return;
    submitting = true;
    setButtonState(refs.submit, "loading");
    refs.closeBtn.disabled = true;
    try {
      await onSubmit?.(selection.ids);
    } catch {
      if (refs) { setButtonState(refs.submit, "default"); refs.closeBtn.disabled = false; }
    } finally {
      submitting = false;
    }
  }

  // Called by the catalog on every selection change while the sheet exists.
  function update() {
    if (el && el.dataset.state === "open") renderAnimated();
  }

  function open() {
    if (el && el.dataset.state === "open") return;
    if (!selection.size) return;
    clearTimeout(closeTimer);
    backdrop?.remove();
    el?.remove();
    itemNodes.clear();
    backdrop = createModalBackdrop({ onDismiss: () => close() });
    el = build();
    render();
    document.body.append(backdrop, el);
    openBackdrop(backdrop);
    void el.offsetWidth;
    el.dataset.state = "open";
    document.addEventListener("keydown", onKey);
    setTimeout(() => refs?.closeBtn.focus({ preventScroll: true }), reducedMotion() ? 0 : OPEN_MS);
  }

  function close({ immediate = false } = {}) {
    if (!el || el.dataset.state !== "open") return;
    document.removeEventListener("keydown", onKey);
    closeBackdrop(backdrop);
    el.dataset.state = "closing";
    const sheet = el, bd = backdrop;
    const done = () => { sheet.remove(); bd.remove(); if (el === sheet) { el = null; backdrop = null; refs = null; itemNodes.clear(); } };
    if (immediate || reducedMotion()) done();
    else closeTimer = setTimeout(done, CLOSE_MS);
  }

  return { open, close, update, get isOpen() { return !!el && el.dataset.state === "open"; } };
}
