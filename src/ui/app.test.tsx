// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import { App, transitions, type UploadState } from "./app.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

function renderedTestIds(state: UploadState): string[] {
  render(<App initialState={state} />, container);
  return [...container.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid") ?? "");
}

describe("App state machine shell", () => {
  it("renders only the form when idle (default)", () => {
    render(<App />, container);
    expect(container.querySelectorAll("[data-testid]")).toHaveLength(1);
    expect(container.querySelector("[data-testid=upload-form]")).not.toBeNull();
  });

  it("renders only the progress child when uploading", () => {
    expect(renderedTestIds({ status: "uploading" })).toEqual(["upload-progress"]);
  });

  it("renders only the result child, flagged success, on success", () => {
    expect(renderedTestIds({ status: "success" })).toEqual(["upload-result"]);
    expect(container.querySelector("[data-testid=upload-result]")?.getAttribute("data-outcome")).toBe("success");
  });

  it("renders only the result child, flagged error, on error", () => {
    expect(renderedTestIds({ status: "error" })).toEqual(["upload-result"]);
    expect(container.querySelector("[data-testid=upload-result]")?.getAttribute("data-outcome")).toBe("error");
  });
});

describe("transitions", () => {
  it("move idle → uploading → success | error and back to idle", () => {
    expect(transitions.startUpload()).toEqual({ status: "uploading" });
    expect(transitions.succeed()).toEqual({ status: "success" });
    expect(transitions.fail()).toEqual({ status: "error" });
    expect(transitions.reset()).toEqual({ status: "idle" });
  });
});
