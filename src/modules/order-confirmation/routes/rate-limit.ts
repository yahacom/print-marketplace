import type { onRequestAsyncHookHandler } from "fastify";

// PRD §6.1 spam-create abuse case: 10 confirm/decline attempts per minute.
const MAX_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;

const RATE_LIMITED_BODY = {
  code: "order.rate_limited",
  message: "Too many attempts from this connection. Please wait a moment and try again.",
};

// Fixed-window counter shared by the confirm and decline routes, so a client
// cannot get 10 of each. There are no accounts or sessions (PRD §1), so the
// "session" is the client IP, as in stl-upload's and quote-engine's limiters.
// State is in memory: single-instance deployment (SAD §7). All counters reset
// together when the window elapses, which also bounds memory. Attach it as a
// per-route onRequest hook; the GET route is deliberately not limited (T10).
export function createDecisionRateLimit(): onRequestAsyncHookHandler {
  let windowStart = Date.now();
  let counts = new Map<string, number>();

  return async (request, reply) => {
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      counts = new Map();
    }

    const count = (counts.get(request.ip) ?? 0) + 1;
    counts.set(request.ip, count);

    if (count > MAX_ATTEMPTS_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil((windowStart + WINDOW_MS - now) / 1000);
      return reply.code(429).header("retry-after", retryAfterSeconds).send(RATE_LIMITED_BODY);
    }
  };
}
