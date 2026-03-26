import { dilateBinary, erodeBinary } from "./binary-morph";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type BorderPlacement = "outside" | "inside";

/**
 * Outside: expand canvas by `widthPx` on each side, draw border in the new
 * ring, then composite the original image on top.
 * Inside: same size; replace a ring of opaque pixels along the inner edge with
 * the border color.
 */
export function applyBorderToImageData(
  source: ImageData,
  opaqueMask: Uint8Array,
  widthPx: number,
  placement: BorderPlacement,
  color: Rgba
): ImageData {
  const w = source.width;
  const h = source.height;
  const bw = Math.max(0, Math.floor(widthPx));

  if (bw === 0) {
    return new ImageData(new Uint8ClampedArray(source.data), w, h);
  }

  if (placement === "outside") {
    return applyOutsideBorder(source, opaqueMask, w, h, bw, color);
  }
  return applyInsideBorder(source, opaqueMask, w, h, bw, color);
}

function applyOutsideBorder(
  source: ImageData,
  opaqueMask: Uint8Array,
  w: number,
  h: number,
  bw: number,
  color: Rgba
): ImageData {
  const pad = bw;
  const pw = w + 2 * pad;
  const ph = h + 2 * pad;
  const paddedMask = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      paddedMask[(y + pad) * pw + (x + pad)] = opaqueMask[y * w + x] ?? 0;
    }
  }

  const dilated = dilateBinary(paddedMask, pw, ph, bw);
  const out = new ImageData(pw, ph);
  out.data.fill(0);

  for (let i = 0; i < pw * ph; i++) {
    const inOriginal = paddedMask[i] === 1;
    const inDilated = dilated[i] === 1;
    if (inDilated && !inOriginal) {
      const o = i * 4;
      out.data[o] = color.r;
      out.data[o + 1] = color.g;
      out.data[o + 2] = color.b;
      out.data[o + 3] = color.a;
    }
  }

  // Source-over: only opaque/semi-opaque source pixels replace the destination.
  // Fully transparent source pixels must NOT overwrite — otherwise the border
  // drawn in transparent areas inside the image bounds is erased (only the four
  // outer strips outside the w×h box would remain).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = ((y + pad) * pw + (x + pad)) * 4;
      const sa = source.data[si + 3]!;
      if (sa === 0) continue;

      const sr = source.data[si]!;
      const sg = source.data[si + 1]!;
      const sb = source.data[si + 2]!;
      const dr = out.data[di]!;
      const dg = out.data[di + 1]!;
      const db = out.data[di + 2]!;
      const da = out.data[di + 3]!;

      const invSa = 255 - sa;
      const aOut = sa + (da * invSa) / 255;
      if (aOut === 0) continue;

      out.data[di] = Math.round(
        (sr * sa + (dr * da * invSa) / 255) / aOut
      );
      out.data[di + 1] = Math.round(
        (sg * sa + (dg * da * invSa) / 255) / aOut
      );
      out.data[di + 2] = Math.round(
        (sb * sa + (db * da * invSa) / 255) / aOut
      );
      out.data[di + 3] = Math.round(aOut);
    }
  }

  return out;
}

function applyInsideBorder(
  source: ImageData,
  opaqueMask: Uint8Array,
  w: number,
  h: number,
  bw: number,
  color: Rgba
): ImageData {
  const eroded = erodeBinary(opaqueMask, w, h, bw);
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h);

  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const inOpaque = opaqueMask[i] === 1;
    const inEroded = eroded[i] === 1;
    if (inOpaque && !inEroded) {
      out.data[o] = color.r;
      out.data[o + 1] = color.g;
      out.data[o + 2] = color.b;
      out.data[o + 3] = color.a;
    }
  }

  return out;
}
