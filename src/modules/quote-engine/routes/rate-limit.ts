import type { FastifyInstance } from "fastify";

// PRD §6.1: same 30/min/IP as stl-upload, deliberately a separate counter (SAD §8).
const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;

const RATE_LIMITED_BODY = {
  code: "quote.rate_limited",
  message:
    "Too many quote requests from this connection. Please wait a moment and try again.",
};

// Per-IP fixed-window limiter, same shape as stl-upload/routes/rate-limit.ts but
// with its own in-memory state (single-instance deployment, SAD §7). Installs
// its hook on the given instance, so it covers routes registered in the same
// encapsulation context — including the WebSocket handshake request (T10).
export function applyQuoteRateLimit(app: FastifyInstance): void {
  let windowStart = Date.now();
  let counts = new Map<string, number>();

  app.addHook("onRequest", async (request, reply) => {
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      counts = new Map();
    }

    const count = (counts.get(request.ip) ?? 0) + 1;
    counts.set(request.ip, count);

    if (count > MAX_REQUESTS_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil((windowStart + WINDOW_MS - now) / 1000);
      return reply
        .code(429)
        .header("retry-after", retryAfterSeconds)
        .send(RATE_LIMITED_BODY);
    }
  });
}
