import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateFileId } from "../../stl-upload/file-id.js";
import { readModel } from "./model-reader.js";

let storageDir: string;

beforeEach(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "model-reader-"));
  process.env.STORAGE_DIR = storageDir;
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
});

it("AC-mr-1: returns the stored bytes for an existing file-id", async () => {
  const fileId = generateFileId();
  const bytes = Buffer.from([0x73, 0x6f, 0x6c, 0x69, 0x64, 0x00, 0xff]);
  await writeFile(join(storageDir, `${fileId}.stl`), bytes);

  const result = await readModel(fileId);

  expect(Buffer.isBuffer(result) && result.equals(bytes)).toBe(true);
});

it("AC-mr-2: returns notFound for a well-formed id with no file", async () => {
  expect(await readModel(generateFileId())).toEqual({ notFound: true });
});

it.each(["../../etc/passwd", "..", "a/b", "a\\b", "id.stl", "", "id\0"])(
  "AC-mr-3: returns the same notFound for malformed id %j",
  async (badId) => {
    expect(await readModel(badId)).toEqual({ notFound: true });
  },
);

it("AC-mr-3: does not read a file outside the storage dir via traversal", async () => {
  await writeFile(join(storageDir, "..", "secret.stl"), "x").catch(() => {});
  expect(await readModel("../secret")).toEqual({ notFound: true });
  await rm(join(storageDir, "..", "secret.stl"), { force: true });
});

it("propagates non-ENOENT fs errors instead of reporting notFound", async () => {
  const fileId = generateFileId();
  // A directory where the file should be makes readFile fail with EISDIR.
  await mkdir(join(storageDir, `${fileId}.stl`));

  await expect(readModel(fileId)).rejects.toThrow();
});
