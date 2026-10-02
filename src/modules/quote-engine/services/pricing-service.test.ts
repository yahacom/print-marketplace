import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { computePrice, loadPricingConfig } from "./pricing-service.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pricing-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("AC-ps-1: returns the breakdown and totalPrice is the sum of its parts", () => {
  const price = computePrice({ timeMinutes: 37.5, filamentGrams: 12.34 });

  expect(Object.keys(price).sort()).toEqual(["margin", "materialCost", "timeCost", "totalPrice"]);
  expect(price.totalPrice).toBeCloseTo(price.timeCost + price.materialCost + price.margin, 12);
});

it("AC-ps-2: matches the hand-calculated value at the confirmed rates (2.5/h, 0.02/g, 20%)", () => {
  // 90 min = 1.5 h -> 3.75; 50 g -> 1.00; subtotal 4.75; margin 20% = 0.95; total 5.70.
  const price = computePrice({ timeMinutes: 90, filamentGrams: 50 });

  expect(price.timeCost).toBe(3.75);
  expect(price.materialCost).toBe(1);
  expect(price.margin).toBe(0.95);
  expect(price.totalPrice).toBeCloseTo(5.7, 12);
});

it("AC-ps-2: a fractional-hour input converts to hours as a float without rounding", () => {
  // 37.5 min = 0.625 h -> 1.5625; 0 g -> 0; margin 20% = 0.3125.
  const price = computePrice({ timeMinutes: 37.5, filamentGrams: 0 });

  expect(price).toEqual({ timeCost: 1.5625, materialCost: 0, margin: 0.3125, totalPrice: 1.875 });
});

it("AC-ps-3: rates come from the config file, so a different file changes the output", async () => {
  const path = join(dir, "pricing.json");
  await writeFile(
    path,
    JSON.stringify({ rate_per_hour: 10, price_per_gram: 1, margin_pct: 50 }),
  );

  const price = computePrice({ timeMinutes: 60, filamentGrams: 2 }, loadPricingConfig(path));

  // 10 + 2 = 12 subtotal, 50% margin = 6.
  expect(price).toEqual({ timeCost: 10, materialCost: 2, margin: 6, totalPrice: 18 });
  expect(price).not.toEqual(computePrice({ timeMinutes: 60, filamentGrams: 2 }));
});

it("rejects a config with a missing or non-numeric rate", async () => {
  const path = join(dir, "bad.json");
  await writeFile(path, JSON.stringify({ rate_per_hour: "2.5", price_per_gram: 0.02, margin_pct: 20 }));

  expect(() => loadPricingConfig(path)).toThrow(/rate_per_hour/);
});
