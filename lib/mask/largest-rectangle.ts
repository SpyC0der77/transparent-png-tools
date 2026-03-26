export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

/**
 * Largest axis-aligned rectangle of 1s in a row-major binary matrix.
 * Histogram + stack, O(rows * cols).
 */
export function largestRectangleInBinaryMatrix(
  mask: Uint8Array,
  gridWidth: number,
  gridHeight: number
): Rectangle | null {
  const heights = new Int32Array(gridWidth);
  let best: Rectangle | null = null;

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const i = row * gridWidth + col;
      if (mask[i]) heights[col] += 1;
      else heights[col] = 0;
    }
    const rowBest = largestRectangleInHistogram(heights, gridWidth, row);
    if (rowBest && (!best || rowBest.area > best.area)) {
      best = rowBest;
    }
  }

  return best;
}

function largestRectangleInHistogram(
  heights: Int32Array,
  n: number,
  bottomRow: number
): Rectangle | null {
  const stack: number[] = [];
  let best: Rectangle | null = null;

  for (let i = 0; i <= n; i++) {
    const curHeight = i < n ? heights[i]! : 0;
    while (
      stack.length > 0 &&
      curHeight < heights[stack[stack.length - 1]!]!
    ) {
      const idx = stack.pop()!;
      const height = heights[idx]!;
      const right = i;
      const left = stack.length === 0 ? -1 : stack[stack.length - 1]!;
      const width = right - left - 1;
      const area = width * height;
      const x = left + 1;
      const y = bottomRow - height + 1;
      if (!best || area > best.area) {
        best = { x, y, width, height, area };
      }
    }
    if (i < n) stack.push(i);
  }

  return best;
}

export function isPointInMask(
  mask: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  x: number,
  y: number
): boolean {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= gridWidth || yi >= gridHeight) return false;
  return mask[yi * gridWidth + xi] === 1;
}

/** Sample corners and edge midpoints; all must be inside safe mask. */
export function bboxFullyInsideMask(
  mask: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  pad: number
): boolean {
  const l = left + pad;
  const t = top + pad;
  const r = right - pad;
  const b = bottom - pad;
  if (l >= r || t >= b) return false;

  const points: [number, number][] = [
    [l, t],
    [r, t],
    [l, b],
    [r, b],
    [(l + r) / 2, t],
    [(l + r) / 2, b],
    [l, (t + b) / 2],
    [r, (t + b) / 2],
    [(l + r) / 2, (t + b) / 2],
  ];

  for (const [px, py] of points) {
    if (!isPointInMask(mask, gridWidth, gridHeight, px, py)) return false;
  }

  return true;
}
