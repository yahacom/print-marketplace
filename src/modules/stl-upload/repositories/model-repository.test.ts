import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateFileId } from "../file-id.js";
import { saveModel } from "./model-repository.js";

let storageDir: string;

beforeEach(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "stl-upload-"));
  process.env.STORAGE_DIR = storageDir;
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
});

it("writes <file-id>.stl under the storage dir with matching bytes", async () => {
  const fileId = generateFileId();
  const bytes = Buffer.from([0x73, 0x6f, 0x6c, 0x69, 0x64, 0x00, 0xff]);

  await saveModel(fileId, bytes);

  const stored = await readFile(join(storageDir, `${fileId}.stl`));
  expect(stored.equals(bytes)).toBe(true);
});

it("creates the storage dir when it does not exist yet", async () => {
  process.env.STORAGE_DIR = join(storageDir, "nested", "models");
  const fileId = generateFileId();

  await saveModel(fileId, Buffer.from("x"));

  const stored = await readFile(
    join(process.env.STORAGE_DIR, `${fileId}.stl`),
  );
  expect(stored.toString()).toBe("x");
});

it("rejects a file-id that could escape the storage dir", async () => {
  await expect(saveModel("../evil", Buffer.from("x"))).rejects.toThrow(
    "Invalid file-id",
  );
});
