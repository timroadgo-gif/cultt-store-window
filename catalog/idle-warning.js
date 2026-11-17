// «Вы еще здесь?» — inactivity warning. Opened by the app's single idle timer (idle.js) after IDLE_TIMEOUT_MS without
// activity on the catalog / product page / fitting sheet. Modal: ModalBackdrop UI Kit (no backdrop dismissal), a card
// with a circular countdown (SVG ring), «Да, продолжить» (primary pill) and «Начать заново» (text action).
// Only three things resolve it: continue, restart, or the countdown reaching zero.
//
// Countdown: driven by elapsed time (performance.now() against a deadline), not by counting callbacks: a 200 ms
// interval decides the number and the timeout (still right if timers are throttled), requestAnimationFrame only draws
// the ring smoothly. It starts when the entrance (≈ 260 ms) has finished.
// While open: the app underneath is inert, Escape and other keys are swallowed, background scroll is blocked; the
// countdown's own updates are not user activity (the idle timer is stopped while the warning is open).
import { createModalBackdrop, openBackdrop, closeBackdrop } from "../design-system/backdrop/backdrop.js?v=00dd94ce5b19";
import { createButton } from "../design-system/components/button/button.js?v=00dd94ce5b19";
import { createTextAction } from "../design-system/components/text-action/text-action.js?v=00dd94ce5b19";
import { pill } from "./ui.js?v=00dd94ce5b19";

const h = (tag, className, ...children) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  for (const c of children) if (c != null) n.append(c);
  return n;
};
const SVG = "http://www.w3.org/2000/svg";
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ENTER_MS = 260;
const EXIT_MS = 200;
const R = 44; // ring radius in a 96 × 96 viewBox
const C = 2 * Math.PI * R;

export function createIdleWarning({ seconds, onContinue, onRestart, onTimeout, inertTargets = () => [] }) {
  let backdrop = null;
  let card = null;
  let refs = null;
  let deadline = 0;
  let tick = null;
  let raf = 0;
  let startTimer = null;
  let resolved = false;
  let inerted = [];

  const swallowKeys = (e) => { // no Escape / keyboard shortcuts reach the page while the decision is pending
    if (!card) return;
    if (e.key === "Tab") { // keep focus inside the card
      const f = [...card.querySelectorAll("button")];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    } else if (!(e.key === "Enter" || e.key === " ") || !card.contains(document.activeElement)) {
      e.preventDefault();
    }
    e.stopImmediatePropagation();
  };
  const blockScroll = (e) => { if (card && !card.contains(e.target)) e.preventDefault(); };

  function build() {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 96 96");
    svg.setAttribute("class", "kidle__ring");
    svg.setAttribute("aria-hidden", "true");
    const track = document.createElementNS(SVG, "circle");
    const progress = document.createElementNS(SVG, "circle");
    for (const [c, cls] of [[track, "kidle__track"], [progress, "kidle__progress"]]) {
      c.setAttribute("cx", "48"); c.setAttribute("cy", "48"); c.setAttribute("r", String(R)); c.setAttribute("class", cls);
    }
    progress.setAttribute("stroke-dasharray", String(C));
    progress.setAttribute("stroke-dashoffset", "0");
    svg.append(track, progress);
    const number = h("span", "kidle__number", String(seconds));
    const timer = h("div", "kidle__timer", svg, number);
    timer.setAttribute("role", "timer");
    timer.setAttribute("aria-label", `Осталось ${seconds} секунд`);

    const title = h("h2", "kidle__title", "Вы еще здесь?");
    title.id = "kidleTitle";
    const text = h("p", "kidle__text", "Если ничего не нажимать, выбранные лоты сбросятся и экран вернется в начало");
    text.id = "kidleText";
    const cont = pill(createButton({ label: "Да, продолжить", variant: "primary", width: "fill", onClick: () => resolve("continue") }));
    cont.classList.add("kidle__continue");
    const restart = createTextAction({ label: "Начать заново", onClick: () => resolve("restart") });
    restart.classList.add("kidle__restart");

    const el = h("div", "kidle ds-corner", timer, title, text, h("div", "kidle__actions", cont, restart));
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "kidleTitle");
    el.setAttribute("aria-describedby", "kidleText");
    refs = { number, progress, timer, cont };
    return el;
  }

  function show() {
    if (card) return; // one instance only
    resolved = false;
    backdrop = createModalBackdrop({}); // no onDismiss: a backdrop tap does not resolve the warning
    backdrop.classList.add("kidle-backdrop");
    card = build();
    inerted = inertTargets().filter((n) => n && !n.inert);
    inerted.forEach((n) => { n.inert = true; });
    document.body.append(backdrop, card);
    openBackdrop(backdrop);
    void card.offsetWidth;
    card.dataset.state = "open";
    window.addEventListener("keydown", swallowKeys, true);
    window.addEventListener("wheel", blockScroll, { capture: true, passive: false });
    window.addEventListener("touchmove", blockScroll, { capture: true, passive: false });
    refs.cont.focus({ preventScroll: true });
    startTimer = setTimeout(startCountdown, reducedMotion() ? 0 : ENTER_MS);
  }

  function remainingMs() { return Math.max(0, deadline - performance.now()); }
  function paint() {
    if (!refs) return;
    const ms = remainingMs();
    const s = Math.ceil(ms / 1000);
    if (refs.number.textContent !== String(s)) {
      refs.number.textContent = String(s);
      refs.timer.setAttribute("aria-label", `Осталось ${s} секунд`);
    }
    refs.progress.setAttribute("stroke-dashoffset", String(C * (1 - ms / (seconds * 1000))));
  }
  function frame() { paint(); if (refs && !resolved) raf = requestAnimationFrame(frame); }
  function startCountdown() {
    startTimer = null;
    if (!card || resolved) return;
    deadline = performance.now() + seconds * 1000;
    card.dataset.counting = "";
    tick = setInterval(() => { paint(); if (remainingMs() <= 0) resolve("timeout"); }, 200);
    raf = requestAnimationFrame(frame);
  }

  function stopTimers() {
    clearTimeout(startTimer); startTimer = null;
    clearInterval(tick); tick = null;
    cancelAnimationFrame(raf); raf = 0;
  }

  // One resolution only. Navigation happens first, under the still-visible modal, then the modal fades out:
  // no intermediate page flashes.
  function resolve(kind) {
    if (!card || resolved) return;
    resolved = true;
    stopTimers();
    if (kind === "timeout" && refs) { refs.number.textContent = "0"; refs.progress.setAttribute("stroke-dashoffset", String(C)); }
    teardown({ animate: true });
    ({ continue: onContinue, restart: onRestart, timeout: onTimeout })[kind]?.();
  }

  function teardown({ animate }) {
    window.removeEventListener("keydown", swallowKeys, true);
    window.removeEventListener("wheel", blockScroll, true);
    window.removeEventListener("touchmove", blockScroll, true);
    inerted.forEach((n) => { n.inert = false; });
    inerted = [];
    const c = card, b = backdrop;
    card = null; backdrop = null; refs = null;
    if (!c) return;
    closeBackdrop(b);
    c.dataset.state = "closing";
    const done = () => { c.remove(); b.remove(); };
    if (animate && !reducedMotion()) setTimeout(done, Math.max(EXIT_MS, 300)); else done();
  }

  return {
    show,
    // Used when the session ends some other way while the warning is open (e.g. confirmation): no callbacks.
    dispose() { resolved = true; stopTimers(); teardown({ animate: false }); },
    get state() { return { open: !!card, counting: tick !== null, remaining: card && tick ? Math.ceil(remainingMs() / 1000) : null, number: refs?.number.textContent ?? null }; },
  };
}
