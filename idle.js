// Reusable inactivity timer. One timer at most: every reset clears the previous one before arming a new one.
// Usage:
//   const idle = createIdleTimer({ timeoutMs, onIdle });
//   idle.start();   // arm (also resets on any pointer / touch / key / wheel activity)
//   idle.stop();    // disarm, listeners stay
//   idle.dispose(); // disarm and remove every listener
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];

export function createIdleTimer({ timeoutMs, onIdle, target = document } = {}) {
  if (!(timeoutMs > 0)) throw new Error("createIdleTimer: timeoutMs must be > 0");
  if (typeof onIdle !== "function") throw new Error("createIdleTimer: onIdle is required");

  let timer = null;
  let armed = false;
  let disposed = false;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const arm = () => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      armed = false;
      onIdle();
    }, timeoutMs);
  };
  const onActivity = () => { if (armed) arm(); };
  const opts = { passive: true, capture: true };
  for (const type of ACTIVITY_EVENTS) target.addEventListener(type, onActivity, opts);

  return {
    start() { if (disposed) return; armed = true; arm(); },
    reset() { if (armed) arm(); },
    stop() { armed = false; clear(); },
    dispose() {
      armed = false;
      disposed = true;
      clear();
      for (const type of ACTIVITY_EVENTS) target.removeEventListener(type, onActivity, opts);
    },
    get active() { return timer !== null; },
    timeoutMs,
  };
}
