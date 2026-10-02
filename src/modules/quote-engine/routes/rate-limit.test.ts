import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, expect, it, vi } from "vitest";
import { applyRateLimit as applyUploadRateLimit } from "../../stl-upload/routes/rate-limit.js";
import { applyQuoteRateLimit } from "./rate-limit.js";

const RATE_LIMITED_BODY = {
  code: "quote.rate_limited",
  message:
    "Too many quote requests from this connection. Please wait a moment and try again.",
};

const buildQuoteApp = () => {
  const app = Fastify();
  applyQuoteRateLimit(app);
  app.get("/quote", async () => ({ ok: true }));
  return app;
};

const get = (app: FastifyInstance, url = "/quote", remoteAddress = "10.0.0.1") =>
  app.inject({ method: "GET", url, remoteAddress });

afterEach(() => {
  vi.useRealTimers();
});

it("AC-rl-1: allows requests up to the 30th within a minute", async () => {
  const app = buildQuoteApp();

  for (let i = 1; i <= 30; i++) {
    expect((await get(app)).statusCode).toBe(200);
  }
});

it("AC-rl-2: rejects the 31st request with quote.rate_limited and a retry-after", async () => {
  const app = buildQuoteApp();
  for (let i = 0; i < 30; i++) await get(app);

  const res = await get(app);

  expect(res.statusCode).toBe(429);
  expect(res.json()).toEqual(RATE_LIMITED_BODY);
  expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
});

it("counts each client IP separately", async () => {
  const app = buildQuoteApp();
  for (let i = 0; i < 31; i++) await get(app, "/quote", "10.0.0.1");

  expect((await get(app, "/quote", "10.0.0.1")).statusCode).toBe(429);
  expect((await get(app, "/quote", "10.0.0.2")).statusCode).toBe(200);
});

it("accepts requests again once the 1-minute window has elapsed", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const app = buildQuoteApp();
  for (let i = 0; i < 31; i++) await get(app);
  expect((await get(app)).statusCode).toBe(429);

  vi.setSystemTime(Date.now() + 60_000);

  expect((await get(app)).statusCode).toBe(200);
});

it("AC-rl-3: exhausting stl-upload's limiter does not affect the quote counter", async () => {
  const app = Fastify();
  await app.register(async (scope) => {
    applyUploadRateLimit(scope);
    scope.get("/upload", async () => ({ ok: true }));
  });
  await app.register(async (scope) => {
    applyQuoteRateLimit(scope);
    scope.get("/quote", async () => ({ ok: true }));
  });
  for (let i = 0; i < 31; i++) await get(app, "/upload");
  expect((await get(app, "/upload")).statusCode).toBe(429);

  expect((await get(app, "/quote")).statusCode).toBe(200);

  // And the reverse: quote requests do not consume stl-upload's budget.
  const fresh = Fastify();
  await fresh.register(async (scope) => {
    applyUploadRateLimit(scope);
    scope.get("/upload", async () => ({ ok: true }));
  });
  await fresh.register(async (scope) => {
    applyQuoteRateLimit(scope);
    scope.get("/quote", async () => ({ ok: true }));
  });
  for (let i = 0; i < 31; i++) await get(fresh, "/quote");
  expect((await get(fresh, "/quote")).statusCode).toBe(429);
  expect((await get(fresh, "/upload")).statusCode).toBe(200);
});
