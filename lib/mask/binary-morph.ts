/** 8-connected binary morphology on row-major masks (opaque = 1). */

function get(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return mask[y * width + x] ? 1 : 0;
}

export function dilateBinary(
  mask: Uint8Array,
  width: number,
  height: number,
  iterations: number
): Uint8Array {
  let a = new Uint8Array(mask);
  for (let iter = 0; iter < iterations; iter++) {
    const b = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (a[i]) {
          b[i] = 1;
          continue;
        }
        let hit = 0;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (get(a, width, height, x + dx, y + dy)) {
              hit = 1;
              break;
            }
          }
        }
        b[i] = hit;
      }
    }
    a = b;
  }
  return a;
}

/** 4-neighbor erosion; out-of-bounds treated as 0 so edges shrink. */
export function erodeBinary(
  mask: Uint8Array,
  width: number,
  height: number,
  iterations: number
): Uint8Array {
  let a = new Uint8Array(mask);
  for (let iter = 0; iter < iterations; iter++) {
    const b = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!a[i]) {
          b[i] = 0;
          continue;
        }
        const ok =
          get(a, width, height, x, y) &&
          get(a, width, height, x - 1, y) &&
          get(a, width, height, x + 1, y) &&
          get(a, width, height, x, y - 1) &&
          get(a, width, height, x, y + 1);
        b[i] = ok ? 1 : 0;
      }
    }
    a = b;
  }
  return a;
}
