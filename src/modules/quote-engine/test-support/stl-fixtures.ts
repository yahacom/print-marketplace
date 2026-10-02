// Programmatic ASCII-STL fixtures (no committed binaries). Expected PrusaSlicer
// behavior for each is tabulated in T4's "Verified CLI behavior".

type Vec = [number, number, number];
type Triangle = [Vec, Vec, Vec];

// Outward-facing 12-triangle cube with the given edge length in mm.
const cubeTriangles = (size: number): Triangle[] => {
  const v = (x: number, y: number, z: number): Vec => [x * size, y * size, z * size];
  const quad = (a: Vec, b: Vec, c: Vec, d: Vec): Triangle[] => [
    [a, b, c],
    [a, c, d],
  ];
  return [
    ...quad(v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)),
    ...quad(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)),
    ...quad(v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)),
    ...quad(v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)),
    ...quad(v(1, 1, 0), v(0, 1, 0), v(0, 1, 1), v(1, 1, 1)),
    ...quad(v(0, 1, 0), v(0, 0, 0), v(0, 0, 1), v(0, 1, 1)),
  ];
};

const toAsciiStl = (triangles: Triangle[]): string =>
  [
    "solid fixture",
    ...triangles.map(
      (t) =>
        `facet normal 0 0 0\nouter loop\n${t.map((p) => `vertex ${p.join(" ")}`).join("\n")}\nendloop\nendfacet`,
    ),
    "endsolid fixture",
  ].join("\n");

// Watertight and printable (20 mm cube).
export const validCubeStl = (): string => toAsciiStl(cubeTriangles(20));

// One triangle removed: `--info` reports manifold = no, but PrusaSlicer still slices it (exit 0).
export const nonWatertightCubeStl = (): string => toAsciiStl(cubeTriangles(20).slice(1));

// Watertight but 300 mm on a side, larger than the 250x210x220 bed: exit 0, no G-code.
export const oversizedCubeStl = (): string => toAsciiStl(cubeTriangles(300));
