import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateFileId } from "../file-id.js";
import { modelExists, saveModel } from "./model-repository.js";

let storageDir: string;

beforeEach(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "stl-upload-"));
  process.env.STORAGE_DIR = storageDir;
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
});

it("is true for a file written by saveModel", async () => {
  const fileId = generateFileId();
  await saveModel(fileId, Buffer.from("x"));

  expect(await modelExists(fileId)).toBe(true);
});

it("is false for an unknown id", async () => {
  expect(await modelExists(generateFileId())).toBe(false);
});

it("is false, not thrown, for a malformed id", async () => {
  expect(await modelExists("../evil")).toBe(false);
  expect(await modelExists("")).toBe(false);
});
