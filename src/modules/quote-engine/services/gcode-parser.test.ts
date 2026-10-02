import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { parseSliceOutput } from "./gcode-parser.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string) => readFileSync(join(fixtureDir, name), "utf8");
const realGcodePath = join(fixtureDir, "gcode-real-stats.gcode");
const ok = (stdout = "", stderr = "") => ({ exitCode: 0, stdout, stderr });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gcode-parser-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const gcodeFile = async (content: string) => {
  const path = join(dir, "out.gcode");
  await writeFile(path, content);
  return path;
};

it("AC-gp-1: parses stats from real --info output and real G-code comments", async () => {
  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: realGcodePath,
  });

  expect(result.kind).toBe("stats");
  if (result.kind !== "stats") return;
  expect(result.timeMinutes).toBeCloseTo(29.07, 2); // 29m 4s
  expect(result.filamentGrams).toBe(4.26);
});

it.each([
  ["29m 4s", 29 + 4 / 60],
  ["1h 2m 3s", 62 + 3 / 60],
  ["1d 2h 3m 4s", 1440 + 120 + 3 + 4 / 60],
  ["45s", 0.75],
  ["2h", 120],
])("parses the time format %s", async (text, minutes) => {
  const path = await gcodeFile(
    `; total filament used [g] = 1.50\n; estimated printing time (normal mode) = ${text}\n`,
  );

  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: path,
  });

  expect(result).toEqual({ kind: "stats", timeMinutes: minutes, filamentGrams: 1.5 });
});

it("uses the normal-mode time, not the silent-mode line", async () => {
  const path = await gcodeFile(
    "; total filament used [g] = 1\n; estimated printing time (silent mode) = 9h\n; estimated printing time (normal mode) = 1h\n",
  );

  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: path,
  });

  expect(result).toMatchObject({ kind: "stats", timeMinutes: 60 });
});

it("treats 0 g as a valid stat", async () => {
  const path = await gcodeFile(
    "; total filament used [g] = 0.00\n; estimated printing time (normal mode) = 1m\n",
  );

  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: path,
  });

  expect(result).toEqual({ kind: "stats", timeMinutes: 1, filamentGrams: 0 });
});

it("AC-gp-2a: no G-code plus the slicer's out-of-volume message is exceeds_build_volume", async () => {
  // Info with the sizes blanked out, so only the message signal can fire.
  const infoWithoutSizes = fixture("info-real.txt").replace(/^size_.*$/gm, "");

  const result = await parseSliceOutput({
    info: ok(infoWithoutSizes),
    slice: ok("", fixture("slice-oversized-stderr.txt")),
    gcodePath: null,
  });

  expect(result).toEqual({ kind: "exceeds_build_volume" });
});

it("AC-gp-2b: --info sizes beyond the profile's bed are exceeds_build_volume, without relying on message text", async () => {
  const result = await parseSliceOutput({
    info: ok(fixture("info-oversized.txt")),
    slice: ok(),
    gcodePath: realGcodePath,
  });

  expect(result).toEqual({ kind: "exceeds_build_volume" });
});

it("AC-gp-2b: taller than max_print_height alone is exceeds_build_volume", async () => {
  const tall = fixture("info-real.txt").replace(/size_z = .*/, "size_z = 221.000000");

  const result = await parseSliceOutput({
    info: ok(tall),
    slice: ok(),
    gcodePath: realGcodePath,
  });

  expect(result).toEqual({ kind: "exceeds_build_volume" });
});

it("AC-gp-3: G-code without the stats comments is parse_error", async () => {
  const path = await gcodeFile("G1 X0 Y0\n; some other comment\n");

  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: path,
  });

  expect(result.kind).toBe("parse_error");
});

it.each(["about 5 minutes", "1w 2d", "", "12"])(
  "AC-gp-3: unrecognized time format %j is parse_error, not wrong numbers",
  async (text) => {
    const path = await gcodeFile(
      `; total filament used [g] = 1\n; estimated printing time (normal mode) = ${text}\n`,
    );

    const result = await parseSliceOutput({
      info: ok(fixture("info-real.txt")),
      slice: ok(),
      gcodePath: path,
    });

    expect(result.kind).toBe("parse_error");
  },
);

it("AC-gp-3: a non-numeric filament value is parse_error", async () => {
  const path = await gcodeFile(
    "; total filament used [g] = lots\n; estimated printing time (normal mode) = 1m\n",
  );

  const result = await parseSliceOutput({
    info: ok(fixture("info-real.txt")),
    slice: ok(),
    gcodePath: path,
  });

  expect(result.kind).toBe("parse_error");
});

it("AC-gp-3: missing manifold line or missing G-code is parse_error", async () => {
  const noManifold = fixture("info-real.txt").replace(/^manifold.*$/m, "");
  expect(
    (await parseSliceOutput({ info: ok(noManifold), slice: ok(), gcodePath: realGcodePath })).kind,
  ).toBe("parse_error");
  expect(
    (await parseSliceOutput({ info: ok(fixture("info-real.txt")), slice: ok(), gcodePath: null })).kind,
  ).toBe("parse_error");
  expect(
    (await parseSliceOutput({ info: ok(fixture("info-real.txt")), slice: null, gcodePath: null })).kind,
  ).toBe("parse_error");
});

it("AC-gp-4: manifold = no is non_manifold even when the G-code parses fine", async () => {
  const result = await parseSliceOutput({
    info: ok(fixture("info-non-manifold.txt")),
    slice: ok(),
    gcodePath: realGcodePath,
  });

  expect(result).toEqual({ kind: "non_manifold" });
});
