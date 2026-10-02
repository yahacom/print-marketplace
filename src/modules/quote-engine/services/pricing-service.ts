import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// total = time_hours * rate_per_hour + filament_grams * price_per_gram + margin,
// where margin is margin_pct of that time+material subtotal (T6, config/pricing.json).

export interface PricingConfig {
  rate_per_hour: number;
  price_per_gram: number;
  margin_pct: number;
}

export interface PriceBreakdown {
  timeCost: number;
  materialCost: number;
  margin: number;
  totalPrice: number;
}

const DEFAULT_CONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "config",
  "pricing.json",
);

export const loadPricingConfig = (path = DEFAULT_CONFIG_PATH): PricingConfig => {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const config = raw as Partial<PricingConfig>;
  for (const key of ["rate_per_hour", "price_per_gram", "margin_pct"] as const) {
    if (typeof config[key] !== "number" || !Number.isFinite(config[key])) {
      throw new Error(`pricing config ${path}: ${key} must be a finite number`);
    }
  }
  return config as PricingConfig;
};

let defaultConfig: PricingConfig | undefined;

// No rounding here: the displayed precision is a UI concern (T12).
export const computePrice = (
  input: { timeMinutes: number; filamentGrams: number },
  config: PricingConfig = (defaultConfig ??= loadPricingConfig()),
): PriceBreakdown => {
  const timeCost = (input.timeMinutes / 60) * config.rate_per_hour;
  const materialCost = input.filamentGrams * config.price_per_gram;
  const margin = ((timeCost + materialCost) * config.margin_pct) / 100;
  return { timeCost, materialCost, margin, totalPrice: timeCost + materialCost + margin };
};
