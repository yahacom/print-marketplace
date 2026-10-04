import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRepository, StoredOrder } from "../repositories/order-repository.js";
import { createOrderService } from "./order-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

const quote: StoredOrder = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};
const decidedQuote = { ...quote, decision: "confirmed" } as StoredOrder;

const getDraftOrder = vi.fn<OrderRepository["getDraftOrder"]>();
const decideOrder = vi.fn<OrderRepository["decideOrder"]>();
const modelFileCheck = vi.fn<(fileId: string) => Promise<boolean>>();
const service = createOrderService({ repository: { getDraftOrder, decideOrder }, modelFileCheck });

beforeEach(() => {
  vi.resetAllMocks();
  modelFileCheck.mockResolvedValue(true);
  decideOrder.mockResolvedValue("decided");
});

describe("decide", () => {
  it("AC-01: confirm records the decision after checking the model file", async () => {
    getDraftOrder.mockResolvedValue(quote);

    expect(await service.decide(FILE_ID, "confirmed")).toBe("decided");
    expect(modelFileCheck).toHaveBeenCalledWith(FILE_ID);
    expect(decideOrder).toHaveBeenCalledWith(FILE_ID, "confirmed");
  });

  it("AC-02: decline records the decision without checking the model file", async () => {
    getDraftOrder.mockResolvedValue(quote);

    expect(await service.decide(FILE_ID, "declined")).toBe("decided");
    expect(modelFileCheck).not.toHaveBeenCalled();
    expect(decideOrder).toHaveBeenCalledWith(FILE_ID, "declined");
  });

  it.each(["confirmed", "declined"] as const)(
    "AC-04: %s on an already-decided quote is already_decided and writes nothing",
    async (decision) => {
      getDraftOrder.mockResolvedValue(decidedQuote);

      expect(await service.decide(FILE_ID, decision)).toBe("already_decided");
      expect(decideOrder).not.toHaveBeenCalled();
    },
  );

  it.each(["confirmed", "declined"] as const)(
    "AC-04: %s that loses the race inside the transaction is already_decided",
    async (decision) => {
      getDraftOrder.mockResolvedValue(quote);
      decideOrder.mockResolvedValue("already_decided");

      expect(await service.decide(FILE_ID, decision)).toBe("already_decided");
    },
  );

  it("AC-05: confirm with the model file gone is file_missing and writes nothing", async () => {
    getDraftOrder.mockResolvedValue(quote);
    modelFileCheck.mockResolvedValue(false);

    expect(await service.decide(FILE_ID, "confirmed")).toBe("file_missing");
    expect(decideOrder).not.toHaveBeenCalled();
  });

  it("AC-03: no quote yet is not_found for confirm and decline, with no file check or write", async () => {
    getDraftOrder.mockResolvedValue(null);

    expect(await service.decide(FILE_ID, "confirmed")).toBe("not_found");
    expect(await service.decide(FILE_ID, "declined")).toBe("not_found");
    expect(modelFileCheck).not.toHaveBeenCalled();
    expect(decideOrder).not.toHaveBeenCalled();
  });

  it("propagates repository failures", async () => {
    getDraftOrder.mockRejectedValue(new Error("firestore down"));

    await expect(service.decide(FILE_ID, "declined")).rejects.toThrow("firestore down");
  });
});

describe("getOrderState", () => {
  it("AC-03: no quote yet is not_found", async () => {
    getDraftOrder.mockResolvedValue(null);

    expect(await service.getOrderState(FILE_ID)).toEqual({ kind: "not_found" });
  });

  it("a quote with no decision is ready, carrying the stored quote fields", async () => {
    getDraftOrder.mockResolvedValue(quote);

    expect(await service.getOrderState(FILE_ID)).toEqual({ kind: "ready", order: quote });
  });

  it("US-04: reopening shows the already-recorded decision", async () => {
    getDraftOrder.mockResolvedValue(decidedQuote);

    expect(await service.getOrderState(FILE_ID)).toEqual({ kind: "decided", order: decidedQuote });
  });
});
