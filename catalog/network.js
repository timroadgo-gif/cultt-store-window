// Connectivity for the kiosk: one shared monitor for every screen.
//
// What is known and how:
//   • device offline   — navigator.onLine === false / the «offline» event (reliable in that direction only);
//   • service unreachable — the device reports a network, but a reachability probe fails (no response / HTTP error);
//   • timeout          — the probe or the order call did not answer within its time limit (counted as unreachable);
//   • order failure    — the order call answered with an error while the service is reachable: NOT a connectivity
//                        problem, handled by the fitting sheet's error flow (request.js → OrderError "server").
// navigator.onLine === true is never trusted on its own: «online» events, the order call and a slow heartbeat all go
// through the probe. PROTOTYPE: there is no backend, so the probe asks the kiosk's own host (the web app manifest,
// no-store, HEAD). Replace PROBE_URL with the ordering API's health endpoint once it exists.
//
// UI stability: the offline notice appears only after the problem lasted SHOW_DELAY_MS and, once shown, stays at
// least MIN_VISIBLE_MS — brief fluctuations never flash it. Recovery is automatic (retries with backoff, «online»
// event, tab visible again); nothing reloads the page and no app state is touched.
//
// Prototype simulation (simulator toolbar, outside the iPad screen): simulate("offline" | "reconnecting" | null).
// While simulated, no real probe or order request is made.
const PROBE_URL = "./manifest.webmanifest";
const PROBE_TIMEOUT_MS = 5000;
const SHOW_DELAY_MS = 1200;
const MIN_VISIBLE_MS = 2500;
const MIN_CHECKING_MS = 900; // the «Подключаемся…» indicator never blinks
const RETRY_MS = [2000, 4000, 8000, 15000];
const HEARTBEAT_MS = 30000;

export function createNetwork({ probeUrl = PROBE_URL } = {}) {
  let sim = null; // null | "offline" | "reconnecting"
  let reach = navigator.onLine ? "online" : "offline"; // real state: "online" | "offline" (device) | "unreachable" | "verifying"
  let checking = false;
  let checkingTimer = null;
  let failStreak = 0;
  let shown = false;
  let shownAt = 0;
  let showTimer = null, hideTimer = null, retryTimer = null, retryIdx = 0;
  let inflight = null;
  const subs = new Set();

  const down = () => sim !== null || reach !== "online";
  const reason = () => (!down() ? null : reach === "unreachable" && !sim ? "service" : "device");
  const snapshot = () => ({
    online: !down(), // the ordering service is reachable right now
    shown, // the offline notice is (or should be) visible — debounced
    reason: reason(), // "device" | "service" | null
    checking: sim === "reconnecting" || checking,
    simulated: sim,
  });
  let last = "";
  function emit() {
    const s = snapshot();
    const key = JSON.stringify(s);
    if (key === last) return;
    last = key;
    for (const fn of subs) fn(s);
  }

  function sync() {
    if (down()) {
      clearTimeout(hideTimer); hideTimer = null;
      if (!shown && !showTimer) showTimer = setTimeout(() => { showTimer = null; if (down()) { shown = true; shownAt = Date.now(); emit(); } }, SHOW_DELAY_MS);
      scheduleRetry();
    } else {
      clearTimeout(showTimer); showTimer = null;
      clearTimeout(retryTimer); retryTimer = null; retryIdx = 0;
      if (shown && !hideTimer) hideTimer = setTimeout(() => { hideTimer = null; if (!down()) { shown = false; emit(); } }, Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt)));
    }
    emit();
  }

  function setReach(next) {
    if (next === "online") { failStreak = 0; retryIdx = 0; }
    reach = next;
    sync();
  }

  function scheduleRetry() {
    if (sim || retryTimer || reach === "online") return;
    const wait = RETRY_MS[Math.min(retryIdx, RETRY_MS.length - 1)];
    retryIdx += 1;
    retryTimer = setTimeout(() => { retryTimer = null; check(); }, wait);
  }

  // One real reachability request. Never runs while a state is simulated.
  async function probe({ timeoutMs = PROBE_TIMEOUT_MS } = {}) {
    if (sim) return { ok: false, kind: "offline", simulated: true };
    if (!navigator.onLine) return { ok: false, kind: "offline" };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${probeUrl}?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
      return r.ok ? { ok: true } : { ok: false, kind: "unreachable", status: r.status };
    } catch {
      return { ok: false, kind: ctrl.signal.aborted ? "timeout" : navigator.onLine ? "unreachable" : "offline" };
    } finally {
      clearTimeout(t);
    }
  }

  // Probe and update the shared state. One check at a time; concurrent callers share it.
  function check() {
    if (sim) return Promise.resolve({ ok: false, kind: "offline", simulated: true });
    if (inflight) return inflight;
    clearTimeout(retryTimer); retryTimer = null;
    const quiet = reach === "online"; // heartbeat while fine: no indicator
    if (!quiet) { checking = true; clearTimeout(checkingTimer); emit(); }
    const started = Date.now();
    inflight = (async () => {
      const res = await probe();
      inflight = null;
      // The state is applied at once; only the «Подключаемся…» indicator is held for its minimum time.
      if (!quiet) checkingTimer = setTimeout(() => { checking = false; emit(); }, Math.max(0, MIN_CHECKING_MS - (Date.now() - started)));
      if (sim) { emit(); return res; } // simulation switched on meanwhile: it wins
      if (res.ok) setReach("online");
      else {
        failStreak += 1;
        // A single failed probe while everything looked fine may be a blip: confirm it before telling the visitor.
        if (res.kind === "offline") setReach("offline");
        else if (reach !== "online" || failStreak >= 2) setReach("unreachable");
        else { retryTimer = setTimeout(() => { retryTimer = null; check(); }, 1000); emit(); }
      }
      return res;
    })();
    return inflight;
  }

  addEventListener("offline", () => { if (!sim) setReach("offline"); });
  addEventListener("online", () => { if (!sim) check(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !sim && reach !== "online") check(); });
  setInterval(() => { if (!sim && reach === "online" && document.visibilityState === "visible") check(); }, HEARTBEAT_MS);
  if (reach !== "online") sync();

  return {
    get state() { return snapshot(); },
    get canOrder() { return !down(); },
    subscribe(fn) { subs.add(fn); fn(snapshot()); return () => subs.delete(fn); },
    check,
    probe,
    // An order call failed for a network reason: re-check rather than assume the whole device is offline.
    reportFailure(kind) {
      if (sim) return;
      if (kind === "offline") return setReach(navigator.onLine ? reach : "offline"), check();
      if (kind === "timeout" || kind === "unreachable") { failStreak += 1; check(); }
    },
    // Prototype only: "offline" | "reconnecting" | null (= real connection). Leaving a simulation re-checks for real.
    simulate(mode) {
      const next = mode === "offline" || mode === "reconnecting" ? mode : null;
      if (next === sim) return sim;
      sim = next;
      clearTimeout(retryTimer); retryTimer = null; retryIdx = 0;
      if (sim) sync();
      // Back to the real connection: stay «down» (same notice) until a real probe confirms the service is reachable.
      else { reach = navigator.onLine ? "verifying" : "offline"; sync(); check(); }
      return sim;
    },
  };
}
