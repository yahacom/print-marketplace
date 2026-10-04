import Fastify from "fastify";
import { Writable } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
import { registerRequestLogging, requestLoggingOptions } from "../../../request-logging.js";
import { orderConfirmationModule } from "../module.js";
import type { OrderService } from "../services/order-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const decide = vi.fn<OrderService["decide"]>();
const getOrderState = vi.fn<OrderService["getOrderState"]>();

// Same logging setup as buildApp: the shared request-logging hook plus the
// module, with an injected service.
const appWithCapturedLogs = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
      callback();
    },
  });
  const app = Fastify({ ...requestLoggingOptions, logger: { level: "info", stream } });
  registerRequestLogging(app);
  app.register(orderConfirmationModule, { orderService: { decide, getOrderState } });
  return { app, lines };
};

beforeEach(() => {
  vi.resetAllMocks();
});

it("logs request_id as structured JSON for the GET, confirm and decline routes", async () => {
  decide.mockResolvedValue("decided");
  getOrderState.mockResolvedValue({ kind: "not_found" });
  const { app, lines } = appWithCapturedLogs();

  await app.inject({ url: `/api/v1/orders/${FILE_ID}` });
  await app.inject({ method: "POST", url: `/api/v1/orders/${FILE_ID}/confirm` });
  await app.inject({ method: "POST", url: `/api/v1/orders/${FILE_ID}/decline` });

  const entries = lines.map((line) => JSON.parse(line));
  expect(entries).toHaveLength(3);
  expect(entries.map((entry) => entry.status)).toEqual([404, 201, 200]);
  for (const entry of entries) {
    expect(entry.request_id).toMatch(UUID_V4);
  }
});

it("logs no decision or quote content beyond path and status", async () => {
  getOrderState.mockResolvedValue({
    kind: "decided",
    order: {
      price: 9.5,
      estimatedPrintTime: 5400,
      filamentGrams: 40,
      breakdown: { timeCost: 3.75 },
      filename: "secret-name.stl",
      slicingTime: 1,
      decision: "confirmed",
      decidedAt: { toDate: () => new Date() } as never,
    },
  });
  const { app, lines } = appWithCapturedLogs();

  await app.inject({ url: `/api/v1/orders/${FILE_ID}` });

  const entry = JSON.parse(lines[0]!);
  expect(Object.keys(entry).sort()).toEqual(
    ["duration_ms", "level", "method", "msg", "path", "pid", "hostname", "request_id", "status", "time"].sort(),
  );
  expect(lines[0]!).not.toMatch(/secret-name|confirmed|9\.5|price/);
});

it("an operational failure is logged with its request_id and the response stays generic", async () => {
  getOrderState.mockRejectedValue(new Error("firestore unavailable"));
  const { app, lines } = appWithCapturedLogs();

  const response = await app.inject({
    url: `/api/v1/orders/${FILE_ID}`,
    headers: { "x-request-id": "req-123" },
  });

  expect(response.statusCode).toBe(500);
  const entries = lines.map((line) => JSON.parse(line));
  expect(entries.length).toBeGreaterThanOrEqual(2);
  for (const entry of entries) {
    expect(entry.request_id).toBe("req-123");
  }
});
