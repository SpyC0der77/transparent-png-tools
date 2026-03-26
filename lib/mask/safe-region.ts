import { distanceToTransparent } from "./distance-transform";

/** Pixels inside the shape with distance-to-edge >= margin (disk erosion). */
export function buildSafeMask(
  opaqueMask: Uint8Array,
  width: number,
  height: number,
  marginPx: number
): Uint8Array {
  const dist = distanceToTransparent(opaqueMask, width, height);
  const n = width * height;
  const safe = new Uint8Array(n);
  const m = Math.max(0, marginPx);
  for (let i = 0; i < n; i++) {
    safe[i] = opaqueMask[i] && dist[i] >= m ? 1 : 0;
  }
  return safe;
}
