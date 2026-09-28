import { expect, it } from "vitest";
import { generateFileId } from "./file-id.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it("returns a UUID v4 string", () => {
  expect(generateFileId()).toMatch(UUID_V4);
});

it("produces distinct ids across consecutive calls", () => {
  const count = 1000;
  const ids = new Set(Array.from({ length: count }, generateFileId));

  expect(ids.size).toBe(count);
});
