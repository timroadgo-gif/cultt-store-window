// Шторка «Примерка» (iPad landscape): модальная нижняя шторка над каталогом, одно положение, без «ручки».
// Источник данных — общий selection каталога (тот же объект, что у карточек и панели примерки); своего списка нет.
//   • 5 позиций: выбранные лоты в порядке выбора + тихие свободные места (светлая подложка, маленький «+»).
//   • «×» на карточке убирает лот сразу; карточка гаснет, оставшиеся плавно сдвигаются (FLIP на transform).
//   • Последний лот убран → шторка закрывается, панель примерки в каталоге скрывается (selection пуст).
//   • «Добавить еще» закрывает шторку (выбор сохраняется); при 5 из 5 скрыта.
//   • «Заказать на примерку» → onSubmit (следующий шаг), выбор не очищается.
//   • Без связи шторка работает как обычно (убрать, «Добавить еще», закрыть); заблокирована только отправка: кнопка
//     в состоянии disabled UI Kit, под ней — причина. Связь вернулась → кнопка снова активна, короткое подтверждение.
//     Ошибка отправки (сервис не ответил, таймаут, ошибка сервиса) — пояснение под кнопкой, выбор сохраняется.
// Проданные лоты (сценарий прототипа, catalog/availability.js): остаются на своих местах, фото приглушено, метка
// «Продан», «×» работает как обычно. Под заголовком — «2 товара больше недоступны», слева от кнопки — что сделать; пока
// проданный лот в примерке, «Заказать на примерку» в состоянии disabled UI Kit и ничего не отправляет.
// Подложка — ModalBackdrop UI Kit (легкое затемнение + небольшой размытие, слой целиком плавно появляется).
import { createModalBackdrop, openBackdrop, closeBackdrop } from "../design-system/backdrop/backdrop.js?v=a55d3567b850";
import { createButton, setButtonState } from "../design-system/components/button/button.js?v=a55d3567b850";
import { createIcon } from "../design-system/icons/icon.js?v=a55d3567b850";
import { money } from "./filters.js?v=a55d3567b850";
import { unavailablePhrase } from "./availability.js?v=a55d3567b850";
import { pill } from "./ui.js?v=a55d3567b850";
import { offlineIcon } from "./offline.js?v=a55d3567b850";

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

const NOTE_DEFAULT = "Принесем со склада — обычно это несколько минут";
const NOTES = {
  offline: "Нет подключения к интернету. Заказать получится, когда связь вернется — выбранные лоты сохранятся",
  service: "Сервис примерки недоступен. Заказать получится, когда связь вернется — выбранные лоты сохранятся",
  restored: "Связь восстановлена — можно заказывать",
  timeout: "Сервис не ответил вовремя. Выбранные лоты сохранены — попробуйте еще раз",
  server: "Не получилось отправить заявку. Выбранные лоты сохранены — попробуйте еще раз или обратитесь к консультанту",
};
const RESTORED_MS = 4000;

export function createFittingSheet({ byId, selection, network, availability, onAddMore, onSubmit }) {
  const isSold = (id) => !!availability?.isSold(id);
  const soldIds = () => selection.ids.filter(isSold);
  let backdrop = null;
  let el = null;
  let refs = null;
  let closeTimer = null;
  const itemNodes = new Map();
  const onKey = (e) => { if (e.key === "Escape") close(); };

  function build() {
    const title = h("h2", "kfs__title");
    title.id = "kfsTitle";
    const status = h("p", "kfs__status", h("span", "kfs__status-text"));
    status.setAttribute("role", "status");
    status.hidden = true;
    const closeBtn = createButton({ variant: "secondary", iconPosition: "only", icon: "close", ariaLabel: "Закрыть примерку", onClick: () => close() });
    closeBtn.classList.add("kfs__close", "kc-tool");
    closeBtn.dataset.corner = "circular";
    const slots = h("ul", "kfs__slots");
    slots.setAttribute("aria-label", "Выбранные лоты");

    const addMore = pill(createButton({ label: "Добавить еще", variant: "secondary", onClick: () => { close(); onAddMore?.(); } }));
    addMore.classList.add("kfs__add-more", "kiosk-neutral");
    const submit = pill(createButton({ label: "Заказать на примерку", variant: "primary", width: "fill", onClick: () => submitRequest() }));
    submit.classList.add("kfs__submit");
    const noteIcon = h("span", "kfs__note-icon");
    noteIcon.innerHTML = offlineIcon(16);
    const noteText = h("span", "kfs__note-text", NOTE_DEFAULT);
    const note = h("p", "kfs__note", noteIcon, noteText);
    note.setAttribute("role", "status");
    const block = h("p", "kfs__block");
    block.hidden = true;
    const primary = h("div", "kfs__primary", submit, note);
    const actions = h("div", "kfs__actions", block, addMore, primary);

    const sheet = h("section", "kfs ds-corner", h("header", "kfs__head", h("div", "kfs__heading", title, status), closeBtn), slots, actions);
    sheet.dataset.cornerEdges = "top";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "kfsTitle");
    refs = { title, status, statusText: status.lastChild, block, slots, addMore, closeBtn, submit, note, noteText };
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
    const badge = h("span", "kfs-item__badge", "Продан");
    const node = h("li", "kfs-item",
      h("div", "kfs-item__media ds-corner", img, badge, remove),
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
    paintSold();
  }

  // Sold lots: mark the cards, the line under the title and the hint above the button (counts are always live).
  function paintSold() {
    if (!refs) return;
    const ids = selection.ids;
    const sold = ids.filter(isSold);
    for (const [id, node] of itemNodes) {
      const on = isSold(id);
      node.toggleAttribute("data-sold", on);
      const p = byId.get(id);
      node.querySelector(".kfs-item__remove").setAttribute("aria-label", `Убрать из примерки: ${p.brand} ${p.name}${on ? " (продан)" : ""}`);
    }
    refs.status.hidden = !sold.length;
    refs.block.hidden = !sold.length;
    el.toggleAttribute("data-sold", sold.length > 0);
    if (sold.length) {
      const text = unavailablePhrase(sold.length);
      if (refs.statusText.textContent !== text) refs.statusText.textContent = text;
      const hint = sold.length === 1 ? "Удалите недоступный товар, чтобы продолжить" : "Удалите недоступные товары, чтобы продолжить";
      if (refs.block.textContent !== hint) refs.block.textContent = hint;
    }
    paintNet();
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
  let error = null; // last failed attempt: "offline" | "unreachable" | "timeout" | "server"
  let restoredUntil = 0;
  let restoredTimer = null;
  let wasShown = network?.state.shown ?? false;
  async function submitRequest() {
    if (submitting || !selection.size || soldIds().length) return; // sold lots in the selection: nothing is sent
    if (network && !network.canOrder) { error = network.state.reason === "service" ? "unreachable" : "offline"; paintNet(); return; } // no request at all
    submitting = true;
    error = null;
    setButtonState(refs.submit, "loading");
    refs.closeBtn.disabled = true;
    paintNet();
    try {
      await onSubmit?.(selection.ids);
    } catch (e) {
      error = e?.kind ?? "server";
      if (refs) refs.closeBtn.disabled = false;
    } finally {
      submitting = false;
      paintNet();
    }
  }

  // Button + note from the connection state and the last attempt. The selection is never touched here.
  function paintNet() {
    if (!refs) return;
    const s = network?.state ?? { shown: false, online: true, reason: null };
    const blocked = s.shown || (!s.online && (error === "offline" || error === "unreachable"));
    const soldBlocked = soldIds().length > 0;
    if (!submitting) setButtonState(refs.submit, blocked || soldBlocked ? "disabled" : "default");
    let kind = "default";
    if (blocked) kind = s.reason === "service" ? "service" : "offline";
    else if (error === "timeout" || error === "server" || error === "unreachable") kind = error === "unreachable" ? "timeout" : error;
    else if (Date.now() < restoredUntil) kind = "restored";
    refs.note.dataset.kind = kind;
    refs.note.hidden = soldBlocked && kind === "default"; // the hint above the button is the one message then
    const text = kind === "default" ? NOTE_DEFAULT : NOTES[kind];
    if (refs.noteText.textContent !== text) refs.noteText.textContent = text;
  }
  network?.subscribe((s) => {
    if (wasShown && !s.shown) { // recovered: confirm briefly, then the usual note
      error = null;
      restoredUntil = Date.now() + RESTORED_MS;
      clearTimeout(restoredTimer);
      restoredTimer = setTimeout(paintNet, RESTORED_MS + 20);
    }
    if (s.shown) restoredUntil = 0;
    wasShown = s.shown;
    paintNet();
  });

  availability?.subscribe(() => { if (el) paintSold(); });

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
    error = null;
    paintNet();
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

  return {
    open, close, update,
    get isOpen() { return !!el && el.dataset.state === "open"; },
    get state() { return { open: !!el && el.dataset.state === "open", submit: refs?.submit.dataset.state ?? null, note: refs?.note.dataset.kind ?? null, noteText: refs?.noteText.textContent ?? null, error,
      sold: soldIds(), status: refs && !refs.status.hidden ? refs.statusText.textContent : null, block: refs && !refs.block.hidden ? refs.block.textContent : null }; },
  };
}
