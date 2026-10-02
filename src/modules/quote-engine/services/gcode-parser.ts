import { readFile } from "node:fs/promises";
import { SLICER_PROFILE_PATH, type SliceResult } from "./slicer-service.js";

// Turns T4's raw output into stats or a classified failure (T5, SAD §5).
// PrusaSlicer signals neither an oversized nor a non-watertight model with a
// non-zero exit, so both are classified here from `--info` / the slice output.

export type ParsedSlice =
  | { kind: "stats"; timeMinutes: number; filamentGrams: number }
  | { kind: "non_manifold" }
  | { kind: "exceeds_build_volume" }
  | { kind: "parse_error"; reason: string };

type SliceOutput = Pick<SliceResult, "info" | "slice" | "gcodePath">;

interface BuildVolume {
  x: number;
  y: number;
  z: number;
}

const OUTSIDE_VOLUME_TEXT = "outside of the print volume";
const TIME_LINE = /^; estimated printing time \(normal mode\) = (.+)$/m;
const GRAMS_LINE = /^; total filament used \[g\] = (.+)$/m;
const DURATION = /^(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?$/;

const parseKeyValues = (text: string): Map<string, string> => {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^(\w+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], match[2]);
    }
  }
  return values;
};

// Single source of truth for the bed: the same profile T4 hands to PrusaSlicer.
let buildVolume: Promise<BuildVolume> | undefined;
const readBuildVolume = (): Promise<BuildVolume> => {
  buildVolume ??= readFile(SLICER_PROFILE_PATH, "utf8").then((ini) => {
    const profile = parseKeyValues(ini);
    const points = (profile.get("bed_shape") ?? "")
      .split(",")
      .map((point) => point.split("x").map(Number));
    const xs = points.map((p) => p[0] ?? NaN);
    const ys = points.map((p) => p[1] ?? NaN);
    const volume = {
      x: Math.max(...xs) - Math.min(...xs),
      y: Math.max(...ys) - Math.min(...ys),
      z: Number(profile.get("max_print_height")),
    };
    if (![volume.x, volume.y, volume.z].every((d) => Number.isFinite(d) && d > 0)) {
      throw new Error("slicer profile has no usable bed_shape / max_print_height");
    }
    return volume;
  });
  return buildVolume;
};

const parseDurationMinutes = (text: string): number | null => {
  const match = DURATION.exec(text.trim());
  if (!match || match.slice(1).every((part) => part === undefined)) return null;
  const [days = 0, hours = 0, minutes = 0, seconds = 0] = match
    .slice(1)
    .map((part) => (part === undefined ? 0 : Number(part)));
  return days * 1440 + hours * 60 + minutes + seconds / 60;
};

const exceedsVolume = (info: Map<string, string>, volume: BuildVolume): boolean => {
  const sizes = [
    [Number(info.get("size_x")), volume.x],
    [Number(info.get("size_y")), volume.y],
    [Number(info.get("size_z")), volume.z],
  ] as const;
  return sizes.some(([size, limit]) => Number.isFinite(size) && size > limit);
};

export const parseSliceOutput = async (
  result: SliceOutput,
): Promise<ParsedSlice> => {
  const { info, slice, gcodePath } = result;
  if (!info || !slice) {
    return { kind: "parse_error", reason: "slicer did not complete both stages" };
  }
  const infoValues = parseKeyValues(info.stdout);

  // Build volume: either signal suffices; the size check does not depend on
  // PrusaSlicer's message wording.
  const outsideVolumeMessage =
    gcodePath === null &&
    `${slice.stdout}${slice.stderr}`.includes(OUTSIDE_VOLUME_TEXT);
  if (outsideVolumeMessage || exceedsVolume(infoValues, await readBuildVolume())) {
    return { kind: "exceeds_build_volume" };
  }

  const manifold = infoValues.get("manifold");
  if (manifold === "no") return { kind: "non_manifold" };
  if (manifold !== "yes") {
    return { kind: "parse_error", reason: "--info output has no manifold line" };
  }

  if (gcodePath === null) {
    return { kind: "parse_error", reason: "slicer wrote no G-code" };
  }
  const gcode = await readFile(gcodePath, "utf8");
  const timeText = TIME_LINE.exec(gcode)?.[1];
  const gramsText = GRAMS_LINE.exec(gcode)?.[1];
  if (timeText === undefined || gramsText === undefined) {
    return { kind: "parse_error", reason: "G-code is missing the stats comments" };
  }
  const timeMinutes = parseDurationMinutes(timeText);
  const filamentGrams = Number(gramsText);
  if (timeMinutes === null) {
    return { kind: "parse_error", reason: `unrecognized time format: ${timeText}` };
  }
  if (gramsText.trim() === "" || !Number.isFinite(filamentGrams)) {
    return { kind: "parse_error", reason: `unrecognized filament value: ${gramsText}` };
  }
  return { kind: "stats", timeMinutes, filamentGrams };
};
