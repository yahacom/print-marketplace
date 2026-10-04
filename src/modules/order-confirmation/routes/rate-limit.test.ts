import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderConfirmationModule } from "../module.js";
import type { OrderService } from "../services/order-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

const decide = vi.fn<OrderService["decide"]>();
const getOrderState = vi.fn<OrderService["getOrderState"]>();

const buildTestApp = () => {
  const app = Fastify();
  app.register(orderConfirmationModule, { orderService: { decide, getOrderState } });
  return app;
};

type TestApp = ReturnType<typeof buildTestApp>;

const post = (app: TestApp, action: "confirm" | "decline", remoteAddress = "10.0.0.1") =>
  app.inject({ method: "POST", url: `/api/v1/orders/${FILE_ID}/${action}`, remoteAddress });

beforeEach(() => {
  vi.resetAllMocks();
  decide.mockResolvedValue("already_decided");
  getOrderState.mockResolvedValue({ kind: "not_found" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limiting on confirm/decline", () => {
  it("allows 10 attempts per minute and returns 429 on the 11th", async () => {
    const app = buildTestApp();

    for (let i = 1; i <= 10; i++) {
      expect((await post(app, "confirm")).statusCode).toBe(409);
    }

    const response = await post(app, "confirm");
    expect(response.statusCode).toBe(429);
    expect(response.json().code).toBe("order.rate_limited");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(decide).toHaveBeenCalledTimes(10);
  });

  it("counts confirm and decline attempts together", async () => {
    const app = buildTestApp();

    for (let i = 0; i < 5; i++) {
      await post(app, "confirm");
      await post(app, "decline");
    }

    expect((await post(app, "decline")).statusCode).toBe(429);
    expect((await post(app, "confirm")).statusCode).toBe(429);
  });

  it("counts each client IP separately", async () => {
    const app = buildTestApp();

    for (let i = 0; i < 11; i++) await post(app, "confirm", "10.0.0.1");

    expect((await post(app, "confirm", "10.0.0.1")).statusCode).toBe(429);
    expect((await post(app, "confirm", "10.0.0.2")).statusCode).toBe(409);
  });

  it("accepts attempts again once the 1-minute window has elapsed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = buildTestApp();

    for (let i = 0; i < 11; i++) await post(app, "confirm");
    expect((await post(app, "confirm")).statusCode).toBe(429);

    vi.setSystemTime(Date.now() + 60_000);

    expect((await post(app, "confirm")).statusCode).toBe(409);
  });

  it("does not limit the order-state GET route", async () => {
    const app = buildTestApp();

    for (let i = 0; i < 15; i++) {
      const response = await app.inject({ url: `/api/v1/orders/${FILE_ID}`, remoteAddress: "10.0.0.1" });
      expect(response.statusCode).toBe(404);
    }
  });
});
