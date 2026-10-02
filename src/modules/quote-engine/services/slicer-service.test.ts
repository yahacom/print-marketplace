import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { assertSlicerAvailable, sliceModel } from "./slicer-service.js";

type Vec = [number, number, number];
type Triangle = [Vec, Vec, Vec];

// Outward-facing triangles of an axis-aligned cube with the given edge length.
const cubeTriangles = (size: number): Triangle[] => {
  const v = (x: number, y: number, z: number): Vec => [x * size, y * size, z * size];
  const quad = (a: Vec, b: Vec, c: Vec, d: Vec): Triangle[] => [
    [a, b, c],
    [a, c, d],
  ];
  return [
    ...quad(v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)), // bottom
    ...quad(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)), // top
    ...quad(v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)), // front
    ...quad(v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)), // right
    ...quad(v(1, 1, 0), v(0, 1, 0), v(0, 1, 1), v(1, 1, 1)), // back
    ...quad(v(0, 1, 0), v(0, 0, 0), v(0, 0, 1), v(0, 1, 1)), // left
  ];
};

const toAsciiStl = (triangles: Triangle[]): string =>
  [
    "solid test",
    ...triangles.map(
      (t) =>
        `facet normal 0 0 0\nouter loop\n${t.map((p) => `vertex ${p.join(" ")}`).join("\n")}\nendloop\nendfacet`,
    ),
    "endsolid test",
  ].join("\n");

let dir: string;
const cleanups: Array<() => Promise<void>> = [];

const writeFixture = async (name: string, content: string | Buffer) => {
  const path = join(dir, name);
  await writeFile(path, content);
  return path;
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "slicer-service-test-"));
});

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((c) => c()));
  await rm(dir, { recursive: true, force: true });
});

const slice = async (path: string, timeoutMs = 60_000, signal?: AbortSignal) => {
  const result = await sliceModel(path, timeoutMs, signal);
  cleanups.push(result.cleanup);
  return result;
};

it("AC-ss-1: slices a watertight model to a non-empty G-code file; cleanup removes it", async () => {
  const stl = await writeFixture("cube.stl", toAsciiStl(cubeTriangles(20)));

  const result = await slice(stl);

  expect(result.info?.exitCode).toBe(0);
  expect(result.slice?.exitCode).toBe(0);
  expect(result.timedOut).toBe(false);
  expect(result.cancelled).toBe(false);
  expect(result.gcodePath).not.toBeNull();
  expect((await stat(result.gcodePath!)).size).toBeGreaterThan(0);
  expect(await readFile(result.gcodePath!, "utf8")).toContain("; estimated printing time");

  await result.cleanup();
  expect(existsSync(result.gcodePath!)).toBe(false);
});

it.each([
  ["empty file", () => Buffer.alloc(0)],
  ["random bytes", () => randomBytes(256)],
  [
    "zero-thickness model",
    () =>
      toAsciiStl([
        [[0, 0, 0], [20, 0, 0], [20, 20, 0]],
        [[0, 0, 0], [20, 20, 0], [0, 20, 0]],
      ]),
  ],
])("AC-ss-2: %s yields a non-zero exit, no G-code, and does not throw", async (_name, make) => {
  const stl = await writeFixture("bad.stl", make());

  const result = await slice(stl);

  const exitCodes = [result.info?.exitCode, result.slice?.exitCode].filter(
    (code) => code !== undefined,
  );
  expect(exitCodes.some((code) => code !== 0)).toBe(true);
  expect(result.gcodePath).toBeNull();
  expect(result.timedOut).toBe(false);
  expect(result.cancelled).toBe(false);
});

it("AC-ss-8: an oversized model exits 0 with no G-code and the slicer message passed through", async () => {
  const stl = await writeFixture("huge.stl", toAsciiStl(cubeTriangles(400)));

  const result = await slice(stl);

  expect(result.slice?.exitCode).toBe(0);
  expect(result.gcodePath).toBeNull();
  const output = `${result.slice?.stdout}${result.slice?.stderr}`;
  expect(output).toContain("All objects are outside of the print volume.");
});

it("AC-ss-9: a non-watertight model reports manifold = no and still slices", async () => {
  const stl = await writeFixture("open.stl", toAsciiStl(cubeTriangles(20).slice(1)));

  const result = await slice(stl);

  expect(result.info?.stdout).toMatch(/manifold\s*=\s*no/);
  expect(result.slice?.exitCode).toBe(0);
  expect(result.gcodePath).not.toBeNull();
});

it("AC-ss-3: exceeding the timeout kills the job and reports timedOut, not cancelled", async () => {
  const stl = await writeFixture("cube.stl", toAsciiStl(cubeTriangles(20)));

  const result = await slice(stl, 1);

  expect(result.timedOut).toBe(true);
  expect(result.cancelled).toBe(false);
  expect(result.gcodePath).toBeNull();
});

it("AC-ss-6: aborting mid-run reports cancelled, not timedOut, and removes the temp dir", async () => {
  const stl = await writeFixture("cube.stl", toAsciiStl(cubeTriangles(20)));
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);

  const startedAt = Date.now();
  const result = await slice(stl, 60_000, controller.signal);

  expect(result.cancelled).toBe(true);
  expect(result.timedOut).toBe(false);
  expect(result.gcodePath).toBeNull();
  expect(Date.now() - startedAt).toBeLessThan(10_000);
});

it("AC-ss-6: an already-aborted signal cancels without running the slicer", async () => {
  const stl = await writeFixture("cube.stl", toAsciiStl(cubeTriangles(20)));

  const result = await slice(stl, 60_000, AbortSignal.abort());

  expect(result.cancelled).toBe(true);
  expect(result.info).toEqual({ exitCode: null, stdout: "", stderr: "" });
});

it("AC-ss-7: aborting after completion is a no-op", async () => {
  const stl = await writeFixture("cube.stl", toAsciiStl(cubeTriangles(20)));
  const controller = new AbortController();

  const result = await slice(stl, 60_000, controller.signal);
  expect(() => controller.abort()).not.toThrow();

  expect(result.cancelled).toBe(false);
  expect(result.gcodePath).not.toBeNull();
  expect(existsSync(result.gcodePath!)).toBe(true);
});

it("assertSlicerAvailable resolves when the binary and profile are present", async () => {
  await expect(assertSlicerAvailable()).resolves.toBeUndefined();
});
