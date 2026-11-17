// PROTOTYPE MOCK — there is no backend. submitFittingRequest() stands in for the real «create fitting request» call:
// it resolves after a short network-like delay with a new three-digit request number. The number is random (100–999),
// never repeats the previous one in this session, and is NOT a real request id. Replace this module with the API call.
//
// It never «succeeds» without a connection: the shared network monitor must report the service as reachable, and the
// call itself makes one real reachability request (network.probe — the stand-in for the API round trip). Failures are
// typed (OrderError.kind) so the fitting sheet can explain them and the monitor is told only about network ones:
//   "offline"     — the device has no connection (or it is simulated): no request is made at all;
//   "unreachable" — the device is online, the service did not respond;
//   "timeout"     — no answer within ORDER_TIMEOUT_MS;
//   "server"      — the service answered with an error (not a connectivity problem; the connection state stays).
const MOCK_LATENCY_MS = 450;
const ORDER_TIMEOUT_MS = 8000;
let lastNumber = null;
let nextFailure = null; // prototype testing only (simulator): "server" | "timeout" | null
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class OrderError extends Error {
  constructor(kind) {
    super(`fitting request failed: ${kind}`);
    this.kind = kind;
  }
}

export function setNextOrderFailure(kind) {
  nextFailure = kind === "server" || kind === "timeout" ? kind : null;
  return nextFailure;
}
export const nextOrderFailure = () => nextFailure;

export async function submitFittingRequest(ids, { network } = {}) {
  if (!ids?.length) throw new Error("submitFittingRequest: empty selection");
  if (network && !network.canOrder) throw new OrderError(network.state.reason === "service" ? "unreachable" : "offline");
  const forced = nextFailure;
  nextFailure = null;
  if (forced === "server") { await delay(MOCK_LATENCY_MS); throw new OrderError("server"); }
  if (forced === "timeout") { await delay(1500); throw new OrderError("timeout"); } // shortened for testing
  if (network) {
    const res = await network.probe({ timeoutMs: ORDER_TIMEOUT_MS });
    if (!res.ok) throw new OrderError(res.kind);
  }
  await delay(MOCK_LATENCY_MS);
  let number;
  do number = 100 + Math.floor(Math.random() * 900); while (number === lastNumber);
  lastNumber = number;
  return { number: String(number), ids: [...ids], createdAt: Date.now(), mock: true };
}
