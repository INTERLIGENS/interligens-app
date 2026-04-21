/**
 * Minimal three.js type stubs for the 3D Constellation POC.
 *
 * three 0.184.0 ships without bundled .d.ts files, and the mission freezes
 * package.json to exactly two new deps (react-force-graph-3d + three).
 * Rather than pull in the community @types/three package, we declare just
 * the surface area ConstellationCanvas3D.tsx uses:
 *   - Color
 *   - SphereGeometry
 *   - MeshBasicMaterial
 *   - Mesh
 *   - Object3D (the return-type contract react-force-graph-3d expects)
 *
 * Anything outside this list is unsupported. If the POC graduates, swap
 * this module for @types/three.
 */
declare module "three" {
  export class Object3D {
    position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
  }

  export class Color {
    constructor(color?: string | number);
    r: number;
    g: number;
    b: number;
  }

  export class BufferGeometry extends Object3D {
    dispose(): void;
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class Material {
    transparent: boolean;
    opacity: number;
    dispose(): void;
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: { color?: Color | string | number; transparent?: boolean; opacity?: number });
    color: Color;
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    geometry: BufferGeometry;
    material: Material;
  }
}
