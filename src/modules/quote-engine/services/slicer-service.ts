import { spawn } from "node:child_process";
import { access, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteMetrics } from "../../../metrics.js";

// PrusaSlicer CLI subprocess wrapper (T4, SAD §5). Returns raw outputs only;
// parsing --info / G-code and classifying outcomes belongs to gcode-parser (T5).

const SLICER_BIN = process.env.PRUSA_SLICER_BIN ?? "prusa-slicer";
export const SLICER_PROFILE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "config",
  "slicer-profile-pla.ini",
);
// After SIGTERM, wait this long before SIGKILL (AC-ss-6 "bounded time").
const KILL_GRACE_MS = 2000;

export interface SliceStageOutput {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface SliceResult {
  info: SliceStageOutput | null;
  slice: SliceStageOutput | null;
  gcodePath: string | null;
  timedOut: boolean;
  cancelled: boolean;
  cleanup: () => Promise<void>;
}

type Interruption = "timeout" | "cancel";

const runSlicer = (
  args: string[],
  onChild: (kill: () => void) => void,
): Promise<SliceStageOutput> =>
  new Promise((resolve) => {
    // Argument array, no shell: the STL path is untrusted input (PRD §6.1).
    const child = spawn(SLICER_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killTimer: NodeJS.Timeout | undefined;

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    onChild(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({ exitCode: null, stdout, stderr: stderr + String(error) });
    });
    child.on("close", (exitCode) => {
      clearTimeout(killTimer);
      resolve({ exitCode, stdout, stderr });
    });
  });

const fileHasContent = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
};

// Runs `--info` then `--export-gcode` for one model. One timeout and one
// cancellation cover both calls. Never throws for slicer failures; the caller
// must always call `cleanup()` to remove the per-job temp directory.
export const sliceModel = async (
  stlPath: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<SliceResult> => {
  const workDir = await mkdtemp(join(tmpdir(), "slice-"));
  const cleanup = () => rm(workDir, { recursive: true, force: true });
  const outputPath = join(workDir, "out.gcode");

  // Object state: closures mutate it, so TS must not narrow it to its initial value.
  const state: { interruption: Interruption | null; kill: (() => void) | null } = {
    interruption: null,
    kill: null,
  };
  const interrupt = (reason: Interruption) => {
    state.interruption ??= reason;
    state.kill?.();
  };
  const timeoutTimer = setTimeout(() => interrupt("timeout"), timeoutMs);
  const onAbort = () => interrupt("cancel");
  if (signal?.aborted) onAbort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const run = async (args: string[]): Promise<SliceStageOutput> => {
    if (state.interruption) return { exitCode: null, stdout: "", stderr: "" };
    const output = await runSlicer(args, (kill) => {
      state.kill = kill;
    });
    state.kill = null;
    quoteMetrics.countExitCode(output.exitCode);
    return output;
  };

  let info: SliceStageOutput;
  let slice: SliceStageOutput | null = null;
  try {
    // Always pass an explicit action: an action-less call launches the GUI.
    info = await run(["--load", SLICER_PROFILE_PATH, "--info", stlPath]);
    if (info.exitCode === 0 && !state.interruption) {
      slice = await run([
        "--load",
        SLICER_PROFILE_PATH,
        "--export-gcode",
        "--output",
        outputPath,
        stlPath,
      ]);
    }
  } finally {
    clearTimeout(timeoutTimer);
    signal?.removeEventListener("abort", onAbort);
  }

  const gcodePath =
    !state.interruption && slice?.exitCode === 0 && (await fileHasContent(outputPath))
      ? outputPath
      : null;
  if (state.interruption) await cleanup();

  return {
    info,
    slice,
    gcodePath,
    timedOut: state.interruption === "timeout",
    cancelled: state.interruption === "cancel",
    cleanup,
  };
};

// Fail-fast startup check (T4 edge case): a missing binary should stop the
// service at boot, not surface as a per-request error. T10 calls this when
// registering the module.
export const assertSlicerAvailable = async (): Promise<void> => {
  await access(SLICER_PROFILE_PATH);
  const { exitCode, stderr } = await runSlicer(["--help"], () => {});
  if (exitCode !== 0) {
    throw new Error(`PrusaSlicer binary "${SLICER_BIN}" is not usable: ${stderr}`);
  }
};
