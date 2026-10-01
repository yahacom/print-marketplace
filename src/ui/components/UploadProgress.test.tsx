// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import type { UploadProgressEvent } from "../upload-client.js";
import { UploadProgress } from "./UploadProgress.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

function renderedPercent(): string {
  return container.querySelector("[data-testid=upload-progress-percent]")?.textContent ?? "";
}

describe("UploadProgress", () => {
  it("renders updated progress for each event in a synthetic sequence", () => {
    const total = 1000;
    const events: UploadProgressEvent[] = [
      { loaded: 0, total },
      { loaded: 250, total },
      { loaded: 500, total },
      { loaded: 999, total },
      { loaded: 1000, total },
    ];

    const rendered = events.map((event) => {
      render(<UploadProgress loaded={event.loaded} total={event.total} />, container);
      const bar = container.querySelector("progress");
      return { percent: renderedPercent(), value: bar?.getAttribute("value"), max: bar?.getAttribute("max") };
    });

    expect(rendered).toEqual([
      { percent: "0%", value: "0", max: "1000" },
      { percent: "25%", value: "250", max: "1000" },
      { percent: "50%", value: "500", max: "1000" },
      { percent: "99%", value: "999", max: "1000" },
      { percent: "100%", value: "1000", max: "1000" },
    ]);
  });

  it("never shows more than 100%", () => {
    render(<UploadProgress loaded={1200} total={1000} />, container);
    expect(renderedPercent()).toBe("100%");
  });
});
