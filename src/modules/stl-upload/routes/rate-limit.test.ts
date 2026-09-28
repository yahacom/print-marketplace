import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app.js";

vi.mock("../repositories/model-repository.js", () => ({
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

const RATE_LIMITED_BODY = {
  code: "upload.rate_limited",
  message:
    "Too many uploads from this connection. Please wait a moment and try again.",
};

// Non-multipart requests are cheap (400) but still count toward the limit.
const post = (app: ReturnType<typeof buildApp>, remoteAddress = "10.0.0.1") =>
  app.inject({
    method: "POST",
    url: "/api/v1/uploads",
    remoteAddress,
    payload: {},
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limiting on POST /api/v1/uploads", () => {
  it("allows the 30th request and returns 429 with the openapi body on the 31st", async () => {
    const app = buildApp();

    for (let i = 1; i <= 30; i++) {
      expect((await post(app)).statusCode).not.toBe(429);
    }

    const res = await post(app);
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual(RATE_LIMITED_BODY);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts each client IP separately", async () => {
    const app = buildApp();

    for (let i = 0; i < 31; i++) await post(app, "10.0.0.1");

    expect((await post(app, "10.0.0.1")).statusCode).toBe(429);
    expect((await post(app, "10.0.0.2")).statusCode).not.toBe(429);
  });

  it("accepts requests again once the 1-minute window has elapsed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = buildApp();

    for (let i = 0; i < 31; i++) await post(app);
    expect((await post(app)).statusCode).toBe(429);

    vi.setSystemTime(Date.now() + 60_000);

    expect((await post(app)).statusCode).not.toBe(429);
  });
});
