// PROTOTYPE MOCK — there is no backend. submitFittingRequest() stands in for the real «create fitting request» call:
// it resolves after a short network-like delay with a new three-digit request number. The number is random (100–999),
// never repeats the previous one in this session, and is NOT a real request id. Replace this module with the API call.
const MOCK_LATENCY_MS = 450;
let lastNumber = null;

export async function submitFittingRequest(ids) {
  if (!ids?.length) throw new Error("submitFittingRequest: empty selection");
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
  let number;
  do number = 100 + Math.floor(Math.random() * 900); while (number === lastNumber);
  lastNumber = number;
  return { number: String(number), ids: [...ids], createdAt: Date.now(), mock: true };
}
