import type { FastifyInstance } from "fastify";

// PRD §6.1: same 30/min/IP as stl-upload, deliberately a separate counter (SAD §8).
const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;

const RATE_LIMITED_BODY = {
  code: "quote.rate_limited",
  message:
    "Too many quote requests from this connection. Please wait a moment and try again.",
};

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// Per-IP fixed-window counter, same shape as stl-upload/routes/rate-limit.ts but
// with its own in-memory state (single-instance deployment, SAD §7). All counters
// reset together when the window elapses, which also bounds memory.
export function createQuoteRateLimiter() {
  let windowStart = Date.now();
  let counts = new Map<string, number>();

  return (ip: string): RateLimitDecision => {
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      counts = new Map();
    }

    const count = (counts.get(ip) ?? 0) + 1;
    counts.set(ip, count);

    return count > MAX_REQUESTS_PER_WINDOW
      ? { allowed: false, retryAfterSeconds: Math.ceil((windowStart + WINDOW_MS - now) / 1000) }
      : { allowed: true };
  };
}

// HTTP flavour: rejects with 429 before the route runs. Installs its hook on the
// given instance, so it covers routes registered in the same encapsulation context.
export function applyQuoteRateLimit(app: FastifyInstance): void {
  const check = createQuoteRateLimiter();

  app.addHook("onRequest", async (request, reply) => {
    const decision = check(request.ip);
    if (!decision.allowed) {
      return reply
        .code(429)
        .header("retry-after", decision.retryAfterSeconds)
        .send(RATE_LIMITED_BODY);
    }
  });
}
