// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, transitions } from "./app.js";
import type { QuoteRequest } from "./quote-client.js";

const parseSpy = vi.hoisted(() => vi.fn());

vi.mock("three", () => {
  class Vec3 {
    copy() {
      return this;
    }
    multiplyScalar() {
      return this;
    }
    set() {}
  }
  class Scene {
    add = vi.fn();
  }
  class PerspectiveCamera {
    position = new Vec3();
    updateProjectionMatrix = vi.fn();
  }
  class WebGLRenderer {
    domElement: unknown;
    constructor({ canvas }: { canvas: unknown }) {
      this.domElement = canvas;
    }
    setSize = vi.fn();
    setClearColor = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  class AmbientLight {}
  class DirectionalLight {
    position = new Vec3();
  }
  class MeshStandardMaterial {
    dispose = vi.fn();
  }
  class Mesh {
    position = new Vec3();
    constructor(
      public geometry: unknown,
      public material: unknown,
    ) {}
  }
  return { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, MeshStandardMaterial, Mesh };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    update = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("three/examples/jsm/loaders/STLLoader.js", () => ({
  STLLoader: class {
    parse(buffer: ArrayBuffer) {
      parseSpy(buffer);
      return {
        computeBoundingSphere: vi.fn(),
        boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 1 },
        dispose: vi.fn(),
      };
    }
  },
}));

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  responseText = "";
  timeout = 0;
  upload = { onprogress: null as ((event: unknown) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  send() {}
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const container = document.createElement("div");
document.body.appendChild(container);
afterEach(() => render(null, container));

const QUOTE = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
  dimensions: { x: 10, y: 20, z: 30 },
};

describe("App quote states", () => {
  it("transitions build the quote states", () => {
    expect(transitions.quoteReady(QUOTE, "a.stl")).toEqual({
      status: "quote_ready",
      quote: QUOTE,
      filename: "a.stl",
    });
    expect(transitions.quoteFail({ kind: "connection_lost" }, "a.stl")).toEqual({
      status: "quote_error",
      failure: { kind: "connection_lost" },
      filename: "a.stl",
    });
  });

  it("quote_ready renders the quote and a Back to start button that returns to the form", async () => {
    render(<App initialState={transitions.quoteReady(QUOTE, "a.stl")} />, container);

    expect(container.querySelector("[data-testid=quote-price]")?.textContent).toBe("$5.70");
    expect(container.querySelector("[data-testid=active-filename]")?.textContent).toBe("a.stl");
    expect(container.querySelector("[data-testid=upload-form]")).toBeNull();

    (container.querySelector("button") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector("[data-testid=upload-form]")).not.toBeNull();
    expect(container.querySelector("[data-testid=quote-result]")).toBeNull();
  });

  it("quote_error renders the mapped message only", () => {
    render(
      <App
        initialState={transitions.quoteFail(
          {
            kind: "backend",
            code: "quote.unslicable",
            message: "RAW-BACKEND-DETAIL",
          },
          "a.stl",
        )}
      />,
      container,
    );

    expect(container.querySelector("[data-testid=quote-result-message]")?.textContent).toContain(
      "can't quote it",
    );
    expect(container.textContent).not.toContain("RAW-BACKEND-DETAIL");
  });
});

describe("the selected File reaches the model preview", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("passes the real uploaded File into ModelPreview once quote_ready renders", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const startQuote = vi.fn<(fileId: string, filename: string) => QuoteRequest>(() => ({
      promise: Promise.resolve(QUOTE),
      close: vi.fn(),
    }));
    render(<App startQuote={startQuote} />, container);

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const bytes = new Uint8Array([9, 9, 9]);
    const selected = new File([bytes], "cube.stl");
    Object.defineProperty(input, "files", { value: [selected] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    FakeXhr.last.respond(201, { file_id: "uploaded-id", status: "valid" });
    await flush();
    await flush();
    await flush();

    expect(container.querySelector("[data-testid=model-preview]")).not.toBeNull();
    expect(parseSpy).toHaveBeenCalledOnce();
    const parsedBuffer = parseSpy.mock.calls[0]![0] as ArrayBuffer;
    expect(new Uint8Array(parsedBuffer)).toEqual(bytes);

    vi.unstubAllGlobals();
  });
});
