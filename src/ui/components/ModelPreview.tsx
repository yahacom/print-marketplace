import { useEffect, useRef, useState } from "preact/hooks";
import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

interface ModelPreviewProps {
  file: File | null;
}

// STL carries no color/material data, so every model gets the same neutral material.
const MATERIAL = () => new MeshStandardMaterial({ color: 0x94a3b8 });

// Centers the geometry on its bounding sphere and backs the camera off far enough
// that the model fills the view regardless of the STL's original scale/units.
function frameGeometry(
  geometry: BufferGeometry,
  camera: PerspectiveCamera,
  mesh: Mesh,
) {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (!sphere) return;
  mesh.position.copy(sphere.center).multiplyScalar(-1);
  const radius = Math.max(sphere.radius, 0.001);
  camera.position.set(0, 0, radius * 2.5);
  camera.near = radius / 100;
  camera.far = radius * 100;
  camera.updateProjectionMatrix();
}

export function ModelPreview({ file }: ModelPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!file || !canvasRef.current || !wrapperRef.current) return;

    let cancelled = false;
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setClearColor(0xffffff, 1);

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);

    scene.add(new AmbientLight(0xffffff, 1));
    const directional = new DirectionalLight(0xffffff, 0.8);
    directional.position.set(1, 1, 1);
    scene.add(directional);

    let frameHandle = 0;
    function renderLoop() {
      frameHandle = requestAnimationFrame(renderLoop);
      controls.update();
      renderer.render(scene, camera);
    }

    function resize() {
      const { clientWidth, clientHeight } = wrapper;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    resize();
    renderLoop();

    let mesh: Mesh | null = null;
    file
      .arrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        const geometry = new STLLoader().parse(buffer);
        const material = MATERIAL();
        mesh = new Mesh(geometry, material);
        frameGeometry(geometry, camera, mesh);
        scene.add(mesh);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      mesh?.geometry.dispose();
      (mesh?.material as MeshStandardMaterial | undefined)?.dispose();
    };
  }, [file]);

  if (!file) return null;

  return (
    <div class="model-preview" data-testid="model-preview" ref={wrapperRef}>
      {failed ? (
        <p>Preview unavailable</p>
      ) : (
        <canvas ref={canvasRef} aria-label="3D preview of the uploaded model" />
      )}
    </div>
  );
}
