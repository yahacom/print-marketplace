// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import { toUserMessage } from "../errors.js";
import { UploadResult } from "./UploadResult.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

describe("UploadResult", () => {
  it("renders a crafted filename as inert text, never markup", () => {
    const filename = "<script>alert(1)</script>.stl";
    render(<UploadResult outcome="success" filename={filename} />, container);

    const filenameNode = container.querySelector("[data-testid=upload-result-filename]");
    expect(filenameNode?.textContent).toBe(filename);
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script>");
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });

  it("renders an <img onerror> filename as text without creating an element", () => {
    render(<UploadResult outcome="success" filename={'<img src=x onerror="alert(1)">.stl'} />, container);

    expect(container.querySelector("img")).toBeNull();
  });

  it("confirms the model is ready for the quote step on success", () => {
    render(<UploadResult outcome="success" filename="model.stl" />, container);

    expect(container.querySelector("[data-outcome=success]")?.textContent).toContain(
      "ready for the quote step",
    );
  });

  it("renders the plain-language message for a failure, not the raw backend message", () => {
    const failure = {
      kind: "backend",
      status: 415,
      code: "upload.invalid_format",
      message: "raw internal detail",
    } as const;
    render(<UploadResult outcome="error" failure={failure} />, container);

    const text = container.querySelector("[data-outcome=error]")?.textContent;
    expect(text).toBe(toUserMessage(failure));
    expect(text).not.toContain("raw internal detail");
  });
});
