/**
 * Squared Euclidean distance transform: for each pixel, distance to nearest
 * transparent pixel (mask 0). Opaque pixels are mask 1.
 * Uses Felzenszwalb & Huttenlocher separable 1D passes.
 */

const INF = 1e15;

function squaredDt1d(f: Float64Array, n: number): Float64Array {
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const d = new Float64Array(n);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s =
      (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s =
        (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const t = q - v[k];
    d[q] = t * t + f[v[k]];
  }
  return d;
}

function hasSourceIn1d(f: Float64Array, n: number): boolean {
  for (let i = 0; i < n; i++) {
    if (f[i] < 1) return true;
  }
  return false;
}

function transformRow(
  input: Float64Array,
  width: number,
  y: number,
  output: Float64Array
): void {
  const row = new Float64Array(width);
  const base = y * width;
  for (let x = 0; x < width; x++) {
    row[x] = input[base + x];
  }
  const out = hasSourceIn1d(row, width) ? squaredDt1d(row, width) : row;
  for (let x = 0; x < width; x++) {
    output[base + x] = out[x];
  }
}

function transformColumn(
  input: Float64Array,
  width: number,
  height: number,
  x: number,
  output: Float64Array
): void {
  const col = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    col[y] = input[y * width + x];
  }
  const out = hasSourceIn1d(col, height) ? squaredDt1d(col, height) : col;
  for (let y = 0; y < height; y++) {
    output[y * width + x] = out[y];
  }
}

/**
 * Returns per-pixel Euclidean distance from each opaque pixel to the nearest
 * transparent pixel. Transparent pixels get distance 0.
 */
export function distanceToTransparent(
  opaqueMask: Uint8Array,
  width: number,
  height: number
): Float32Array {
  const n = width * height;
  const init = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    init[i] = opaqueMask[i] ? INF : 0;
  }

  const afterRows = new Float64Array(n);
  for (let y = 0; y < height; y++) {
    transformRow(init, width, y, afterRows);
  }

  const afterCols = new Float64Array(n);
  for (let x = 0; x < width; x++) {
    transformColumn(afterRows, width, height, x, afterCols);
  }

  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!opaqueMask[i]) {
      dist[i] = 0;
      continue;
    }
    const sq = afterCols[i];
    dist[i] = sq >= INF * 0.5 ? 0 : Math.sqrt(Math.max(0, sq));
  }
  return dist;
}
