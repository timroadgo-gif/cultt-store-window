// Final screen after a successful fitting request: «Ваш номер» · request number · instruction · submitted lots ·
// «Готово» · «Экран закроется через N с». A full-screen layer above everything.
//
// Choreography (≈ 950 ms, one easing — the kit's standard ease-out curve, no springs or blur):
//   0 ms     layer rises from the bottom and opens to full screen (clip-path inset + 24 px lift, 560 ms);
//   240 ms   «Ваш номер» fades in;
//   300 ms   digits reveal from below inside a mask, 70 ms apart (520 ms each) — the focal moment;
//   560 ms   instruction, 640 ms thumbnails, 720 ms «Готово» + countdown: 8 px lift + fade (360 ms).
// After the entrance (onEntered) the app resets the visitor's session underneath the opaque layer, so leaving never
// flashes the catalog or the fitting sheet. The 10-second countdown starts only then. «Готово» and the countdown share
// one exit: cancel the timer, fade the layer out (360 ms) over the welcome screen, remove it.
// prefers-reduced-motion: no movement, content shown at once, countdown starts immediately.
import { createButton } from "../design-system/components/button/button.js?v=a55d3567b850";
import { pill } from "./ui.js?v=a55d3567b850";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const CONFIRM_SECONDS = 10;
const ENTER_MS = 960;
const EXIT_MS = 360;

export function createConfirmScreen({ byId, onEntered, onExited }) {
  let layer = null;
  let interval = null;
  let enterTimer = null;
  let exiting = false;
  let remaining = CONFIRM_SECONDS;
  let counter = null;

  function show({ number, ids }) {
    dispose();
    exiting = false;
    remaining = CONFIRM_SECONDS;
    const products = ids.map((id) => byId.get(id)).filter(Boolean); // snapshot of the submitted lots

    const digits = h("span", "kconf__digits");
    [...String(number)].forEach((d, i) => {
      const mask = h("span", "kconf__mask", h("span", "kconf__digit", d));
      mask.style.setProperty("--i", String(i));
      digits.append(mask);
    });
    const numberEl = h("p", "kconf__number", digits);
    numberEl.setAttribute("aria-label", `Ваш номер ${number}`);
    const eyebrow = h("p", "kconf__eyebrow", "Ваш номер");
    const text = h("p", "kconf__text", "Назовите его консультанту — лоты уже собирают, обычно это несколько минут");
    const thumbs = h("ul", "kconf__thumbs", ...products.map((p) => {
      const img = h("img", null);
      Object.assign(img, { src: p.image, alt: `${p.brand} ${p.name}`, draggable: false });
      return h("li", "kconf__thumb ds-corner", img);
    }));
    thumbs.setAttribute("aria-label", "Лоты в заявке");
    const done = pill(createButton({ label: "Готово", variant: "primary", onClick: () => exit() }));
    done.classList.add("kconf__done");
    counter = h("p", "kconf__countdown");
    counter.setAttribute("aria-live", "off");
    paintCounter();

    const inner = h("div", "kconf__inner",
      eyebrow, numberEl, text, thumbs, h("div", "kconf__actions", done, counter));
    layer = h("section", "kconf", inner);
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", `Заявка на примерку отправлена, ваш номер ${number}`);
    layer.dataset.state = "entering";
    if (reducedMotion()) layer.dataset.motion = "reduced";
    document.body.append(layer);
    void layer.offsetWidth;
    layer.dataset.state = "in";

    enterTimer = setTimeout(() => {
      enterTimer = null;
      if (!layer || exiting) return;
      layer.dataset.state = "shown";
      onEntered?.();
      startCountdown();
      done.focus({ preventScroll: true });
    }, reducedMotion() ? 0 : ENTER_MS);
  }

  function paintCounter() {
    if (counter) counter.textContent = `Экран закроется через ${remaining} с`;
  }
  function startCountdown() {
    clearInterval(interval);
    interval = setInterval(() => {
      remaining -= 1;
      paintCounter();
      if (remaining <= 0) exit();
    }, 1000);
  }

  function exit() {
    if (!layer || exiting) return; // one exit only (button and timer can race)
    exiting = true;
    clearInterval(interval);
    interval = null;
    clearTimeout(enterTimer);
    if (enterTimer) { enterTimer = null; onEntered?.(); } // «Готово» during the entrance: still reset first
    enterTimer = null;
    const el = layer;
    el.dataset.state = "out";
    const finish = () => { el.remove(); if (layer === el) layer = null; counter = null; onExited?.(); };
    if (reducedMotion()) finish(); else setTimeout(finish, EXIT_MS);
  }

  function dispose() {
    clearInterval(interval);
    clearTimeout(enterTimer);
    interval = null;
    enterTimer = null;
    layer?.remove();
    layer = null;
    counter = null;
  }

  return {
    show,
    exit,
    dispose,
    get state() { return { open: !!layer, phase: layer?.dataset.state ?? null, remaining, timer: interval !== null }; },
  };
}
