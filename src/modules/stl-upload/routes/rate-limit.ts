import type { FastifyInstance } from "fastify";

const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;

// Response body copied from the openapi.yaml 429 example.
const RATE_LIMITED_BODY = {
  code: "upload.rate_limited",
  message:
    "Too many uploads from this connection. Please wait a moment and try again.",
};

// Per-IP fixed-window limiter (PRD §6.1 abuse case #4). State is an in-memory
// counter: single-instance deployment (SAD §7), so no shared store. All counters
// reset together when the window elapses, which also bounds memory to the IPs
// seen in one window. Installs its hook directly on the given instance (not as a
// child plugin) so it covers routes registered in the same encapsulation context.
export function applyRateLimit(app: FastifyInstance): void {
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
