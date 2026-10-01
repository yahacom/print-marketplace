// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import { App, transitions, type UploadState } from "./app.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

const SECTION_IDS = ["upload-form", "upload-progress", "upload-result"];

// Only the top-level child sections; the real components also carry inner test ids.
function renderedTestIds(state: UploadState): string[] {
  render(<App initialState={state} />, container);
  return [...container.querySelectorAll("[data-testid]")]
    .map((el) => el.getAttribute("data-testid") ?? "")
    .filter((id) => SECTION_IDS.includes(id));
}

describe("App state machine shell", () => {
  it("renders only the form when idle (default)", () => {
    render(<App />, container);
    expect(renderedTestIds({ status: "idle" })).toEqual(["upload-form"]);
  });

  it("renders only the progress child when uploading", () => {
    expect(renderedTestIds({ status: "uploading", progress: { loaded: 1, total: 2 } })).toEqual(["upload-progress"]);
  });

  it("renders only the result child, flagged success, on success", () => {
    expect(renderedTestIds({ status: "success", filename: "a.stl" })).toEqual(["upload-result"]);
    expect(container.querySelector("[data-testid=upload-result]")?.getAttribute("data-outcome")).toBe("success");
  });

  it("renders only the result child, flagged error, on error", () => {
    expect(renderedTestIds({ status: "error", failure: { kind: "network" } })).toEqual(["upload-result"]);
    expect(container.querySelector("[data-testid=upload-result]")?.getAttribute("data-outcome")).toBe("error");
  });
});

describe("transitions", () => {
  it("move idle → uploading → success | error and back to idle", () => {
    expect(transitions.startUpload(new File(["x"], "a.stl"))).toEqual({
      status: "uploading",
      progress: { loaded: 0, total: 1 },
    });
    expect(transitions.succeed("a.stl")).toEqual({ status: "success", filename: "a.stl" });
    expect(transitions.fail({ kind: "timeout" })).toEqual({ status: "error", failure: { kind: "timeout" } });
    expect(transitions.reset()).toEqual({ status: "idle" });
  });
});
