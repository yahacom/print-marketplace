import { describe, expect, it } from "vitest";
import { resolveMaxAttemptsPerWindow } from "./rate-limit.js";

describe("resolveMaxAttemptsPerWindow", () => {
  it("defaults to 10 when unset", () => {
    expect(resolveMaxAttemptsPerWindow(undefined)).toBe(10);
  });

  it("accepts a positive integer override", () => {
    expect(resolveMaxAttemptsPerWindow("100000")).toBe(100000);
  });

  it.each(["", "abc", "0", "-5", "1.5"])("falls back to 10 for invalid value %j", (raw) => {
    expect(resolveMaxAttemptsPerWindow(raw)).toBe(10);
  });
});
