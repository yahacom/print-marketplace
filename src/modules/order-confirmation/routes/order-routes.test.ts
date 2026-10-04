import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { orderConfirmationModule } from "../module.js";
import type { OrderService } from "../services/order-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

const order = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

const decide = vi.fn<OrderService["decide"]>();
const getOrderState = vi.fn<OrderService["getOrderState"]>();

const buildTestApp = () => {
  const app = Fastify();
  app.register(orderConfirmationModule, { orderService: { decide, getOrderState } });
  return app;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/v1/orders/:fileId", () => {
  it("AC-03: 404 no-quote-yet when the document does not exist", async () => {
    getOrderState.mockResolvedValue({ kind: "not_found" });

    const response = await buildTestApp().inject({ url: `/api/v1/orders/${FILE_ID}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "order.not_found", message: "no quote available yet" });
  });

  it("a malformed id gets the same 404 without reaching the service", async () => {
    const response = await buildTestApp().inject({ url: "/api/v1/orders/..%2Fevil" });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("order.not_found");
    expect(getOrderState).not.toHaveBeenCalled();
  });

  it("US-04: 200 with the recorded decision and no controls when already decided", async () => {
    const decidedAt = { toDate: () => new Date("2026-10-04T10:00:00Z") };
    getOrderState.mockResolvedValue({
      kind: "decided",
      order: { ...order, decision: "confirmed", decidedAt: decidedAt as never },
    });

    const response = await buildTestApp().inject({ url: `/api/v1/orders/${FILE_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: "decided",
      decision: "confirmed",
      decidedAt: "2026-10-04T10:00:00.000Z",
      quote: {
        price: 9.5,
        estimatedPrintTime: 5400,
        filamentGrams: 40,
        breakdown: order.breakdown,
        filename: "model.stl",
      },
    });
  });

  it("200 with the stored quote fields and no decision when ready to decide", async () => {
    getOrderState.mockResolvedValue({ kind: "ready", order });

    const response = await buildTestApp().inject({ url: `/api/v1/orders/${FILE_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: "ready",
      quote: {
        price: 9.5,
        estimatedPrintTime: 5400,
        filamentGrams: 40,
        breakdown: order.breakdown,
        filename: "model.stl",
      },
    });
  });

  it("an operational failure is a 500 that does not leak the cause", async () => {
    getOrderState.mockRejectedValue(new Error("firestore secret detail"));

    const response = await buildTestApp().inject({ url: `/api/v1/orders/${FILE_ID}` });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret");
    expect(response.json().code).toBe("order.internal_error");
  });
});

describe("POST /api/v1/orders/:fileId/confirm", () => {
  const confirm = (id = FILE_ID) =>
    buildTestApp().inject({ method: "POST", url: `/api/v1/orders/${id}/confirm` });

  it("AC-01: 201 order confirmed", async () => {
    decide.mockResolvedValue("decided");

    const response = await confirm();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "confirmed" });
    expect(decide).toHaveBeenCalledWith(FILE_ID, "confirmed");
  });

  it("AC-03: 404 no-quote-yet", async () => {
    decide.mockResolvedValue("not_found");

    const response = await confirm();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "order.not_found", message: "no quote available yet" });
  });

  it("AC-04: 409 already decided", async () => {
    decide.mockResolvedValue("already_decided");

    const response = await confirm();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "order.already_decided",
      message: "this quote already has a final decision",
    });
  });

  it("AC-05: 409 model file missing", async () => {
    decide.mockResolvedValue("file_missing");

    const response = await confirm();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "order.file_missing",
      message: "model needs to be re-uploaded before an order can be placed",
    });
  });

  it("a malformed id is a 404 without reaching the service", async () => {
    const response = await confirm("..%2Fevil");

    expect(response.statusCode).toBe(404);
    expect(decide).not.toHaveBeenCalled();
  });
});
