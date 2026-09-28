import { describe, expect, it } from "vitest";
import { resolveMaxRequestsPerWindow } from "./rate-limit.js";

describe("resolveMaxRequestsPerWindow", () => {
  it("defaults to 30 when unset", () => {
    expect(resolveMaxRequestsPerWindow(undefined)).toBe(30);
  });

  it("accepts a positive integer override", () => {
    expect(resolveMaxRequestsPerWindow("1000")).toBe(1000);
  });

  it.each(["", "abc", "0", "-5", "1.5"])(
    "falls back to 30 for invalid value %j",
    (raw) => {
      expect(resolveMaxRequestsPerWindow(raw)).toBe(30);
    },
  );
});
