/** Opaque = 1, transparent = 0 (Uint8Array length width * height, row-major). */

export interface AlphaMaskResult {
  mask: Uint8Array;
  width: number;
  height: number;
}

const DEFAULT_THRESHOLD = 128;

export function imageDataToOpaqueMask(
  data: ImageData,
  alphaThreshold: number = DEFAULT_THRESHOLD
): AlphaMaskResult {
  const { width, height, data: pixels } = data;
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    mask[i] = pixels[p + 3] > alphaThreshold ? 1 : 0;
  }
  return { mask, width, height };
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number; scale: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height, scale: 1 };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}
