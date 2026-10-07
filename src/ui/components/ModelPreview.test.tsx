// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  rendererDispose: vi.fn(),
  controlsDispose: vi.fn(),
  parse: vi.fn(),
}));

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
    aspect = 1;
    near = 0.1;
    far = 1000;
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
    dispose = spies.rendererDispose;
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
    dispose = spies.controlsDispose;
  },
}));

vi.mock("three/examples/jsm/loaders/STLLoader.js", () => ({
  STLLoader: class {
    parse(buffer: ArrayBuffer) {
      return spies.parse(buffer);
    }
  },
}));

const { ModelPreview } = await import("./ModelPreview.js");

function fakeGeometry() {
  return {
    computeBoundingSphere: vi.fn(),
    boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 10 },
    dispose: vi.fn(),
  };
}

const container = document.createElement("div");
document.body.appendChild(container);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  render(null, container);
  vi.clearAllMocks();
});

describe("ModelPreview", () => {
  it("renders nothing when there is no file", () => {
    render(<ModelPreview file={null} />, container);

    expect(container.querySelector("[data-testid=model-preview]")).toBeNull();
  });

  it("renders the preview wrapper and parses the selected file's bytes", async () => {
    spies.parse.mockReturnValue(fakeGeometry());
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const file = {
      arrayBuffer: () => Promise.resolve(bytes),
    } as unknown as File;

    render(<ModelPreview file={file} />, container);
    await flush();
    await flush();

    expect(container.querySelector("[data-testid=model-preview]")).not.toBeNull();
    expect(spies.parse).toHaveBeenCalledExactlyOnceWith(bytes);
  });

  it("disposes the renderer and controls on unmount", async () => {
    spies.parse.mockReturnValue(fakeGeometry());
    const file = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as File;

    render(<ModelPreview file={file} />, container);
    await flush();
    await flush();
    render(null, container);

    expect(spies.rendererDispose).toHaveBeenCalledTimes(1);
    expect(spies.controlsDispose).toHaveBeenCalledTimes(1);
  });
});
