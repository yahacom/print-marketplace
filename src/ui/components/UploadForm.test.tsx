// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES, UploadForm } from "./UploadForm.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

function stlFile(name = "cube.stl", size = 10): File {
  return new File([new Uint8Array(size)], name);
}

function drop(files: File[], items: unknown[] = files.map(() => ({ webkitGetAsEntry: () => ({ isDirectory: false }) }))) {
  const zone = container.querySelector("[data-testid=drop-zone]") as HTMLElement;
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files, items } });
  zone.dispatchEvent(event);
}

function renderForm() {
  const onFileSelected = vi.fn();
  render(<UploadForm onFileSelected={onFileSelected} />, container);
  return onFileSelected;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("UploadForm", () => {
  it("accepts a single valid dropped file", async () => {
    const onFileSelected = renderForm();
    const file = stlFile();
    drop([file]);
    await flush();
    expect(onFileSelected).toHaveBeenCalledExactlyOnceWith(file);
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("accepts a single file chosen via the file input fallback", async () => {
    const onFileSelected = renderForm();
    const file = stlFile();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(onFileSelected).toHaveBeenCalledExactlyOnceWith(file);
  });

  it("rejects multiple files client-side without calling onFileSelected", async () => {
    const onFileSelected = renderForm();
    drop([stlFile("a.stl"), stlFile("b.stl")]);
    await flush();
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Only one model");
  });

  it("rejects a dropped folder client-side without calling onFileSelected", async () => {
    const onFileSelected = renderForm();
    drop([stlFile("inside.stl")], [{ webkitGetAsEntry: () => ({ isDirectory: true }) }]);
    await flush();
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Only one model");
  });

  it("rejects a file over 50 MB with a message distinct from the multi-file one", async () => {
    const onFileSelected = renderForm();
    const oversized = { name: "big.stl", size: MAX_FILE_BYTES + 1 } as File;
    drop([oversized]);
    await flush();
    expect(onFileSelected).not.toHaveBeenCalled();
    const text = container.querySelector("[role=alert]")?.textContent;
    expect(text).toContain("too large");
    expect(text).not.toContain("Only one model");
  });
});
