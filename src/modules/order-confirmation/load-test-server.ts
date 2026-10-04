import Fastify from "fastify";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { orderConfirmationModule } from "./module.js";
import { modelFileExists } from "./repositories/model-file-check.js";
import type { OrderRepository, StoredOrder } from "./repositories/order-repository.js";
import { createOrderService } from "./services/order-service.js";

// Server for the k6 load test (k6/order-load.js, T13). Real routes, rate
// limiter, service and stl-upload file check, but an in-memory repository, so
// CI needs no Firestore credentials. It therefore measures this service's own
// overhead, NOT Firestore latency: to measure the real thing, run k6 against a
// deployment with real Firestore and quotes you have seeded.
//
// Seeds SEED_COUNT draft orders with ids 00000000-0000-4000-8000-<index as 12
// digits>; the k6 script derives the same ids. Even-indexed ones get a model
// file in STORAGE_DIR so confirm (which checks it) succeeds.
const SEED_COUNT = Number(process.env.SEED_COUNT ?? 5000);
const port = Number(process.env.PORT ?? 3000);
const fileIdAt = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

const quote: StoredOrder = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

const orders = new Map<string, StoredOrder>();
const storageDir = process.env.STORAGE_DIR ?? "./storage/models";
await mkdir(storageDir, { recursive: true });
for (let index = 0; index < SEED_COUNT; index++) {
  orders.set(fileIdAt(index), { ...quote });
  if (index % 2 === 0) await writeFile(join(storageDir, `${fileIdAt(index)}.stl`), "solid x");
}

const repository: OrderRepository = {
  getDraftOrder: async (fileId) => orders.get(fileId) ?? null,
  decideOrder: async (fileId, decision) => {
    const order = orders.get(fileId);
    if (!order) return "not_found";
    if (order.decision !== undefined) return "already_decided";
    orders.set(fileId, { ...order, decision, decidedAt: { toDate: () => new Date() } as never });
    return "decided";
  },
};

const app = Fastify();
app.register(orderConfirmationModule, {
  orderService: createOrderService({ repository, modelFileCheck: modelFileExists }),
});
await app.listen({ port, host: "0.0.0.0" });
