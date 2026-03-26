import { bboxFullyInsideMask } from "@/lib/mask/largest-rectangle";
import type { Rectangle } from "@/lib/mask/largest-rectangle";
import {
  parseLineHeightPx,
  wrapTextToWidth,
  type WrappedLayout,
} from "./wrap-and-measure";

export interface FitFontSizeParams {
  ctx: CanvasRenderingContext2D;
  text: string;
  rect: Rectangle;
  safeMask: Uint8Array;
  maskWidth: number;
  maskHeight: number;
  fontFamily: string;
  minFontPx: number;
  maxFontPx: number;
  /** Extra inset inside rect for glyph bounds (mask pixels). */
  glyphPadPx: number;
}

export interface FitFontSizeAtAnchorParams extends FitFontSizeParams {
  /** Horizontal center of the text block (per-line centered on this x). */
  anchorX: number;
  /** Vertical center of the text block. */
  anchorY: number;
  /**
   * When true, the block height must not exceed the inner rect height (centered
   * layout in the largest rectangle). When false, only the safe mask is used
   * so the block can move with drag and font scales to stay in the green.
   */
  constrainRectHeight?: boolean;
}

export interface FitFontSizeResult {
  fontSizePx: number;
  layout: WrappedLayout;
}

/** Fallback stack when callers do not pass a family (e.g. prefer `getCanvasUiFontFamily`). */
const DEFAULT_FONT =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export function fitFontSizeAtAnchor(
  params: FitFontSizeAtAnchorParams
): FitFontSizeResult | null {
  const {
    ctx,
    text,
    rect,
    safeMask,
    maskWidth,
    maskHeight,
    fontFamily,
    minFontPx,
    maxFontPx,
    glyphPadPx,
    anchorX,
    anchorY,
    constrainRectHeight = false,
  } = params;

  if (!text.trim()) {
    return {
      fontSizePx: minFontPx,
      layout: { lines: [], totalHeightPx: 0, maxLineWidthPx: 0 },
    };
  }

  let low = minFontPx;
  let high = maxFontPx;
  let best: FitFontSizeResult | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    ctx.font = `normal 400 ${mid}px ${fontFamily}`;
    const layout = wrapTextToWidth(ctx, text, rect.width - 2 * glyphPadPx);
    if (layout.lines.length === 0) {
      high = mid - 1;
      continue;
    }

    const lineHeight = parseLineHeightPx(ctx);
    const blockHeight = lineHeight * layout.lines.length;
    const innerH = rect.height - 2 * glyphPadPx;
    if (constrainRectHeight && blockHeight > innerH) {
      high = mid - 1;
      continue;
    }

    const blockTop = anchorY - blockHeight / 2;

    if (
      !linesFitMaskAtAnchor(
        safeMask,
        maskWidth,
        maskHeight,
        layout,
        anchorX,
        blockTop,
        lineHeight,
        glyphPadPx * 0.5
      )
    ) {
      high = mid - 1;
      continue;
    }

    best = { fontSizePx: mid, layout };
    low = mid + 1;
  }

  return best;
}

export function fitFontSizeInRect(
  params: FitFontSizeParams
): FitFontSizeResult | null {
  const { rect } = params;
  return fitFontSizeAtAnchor({
    ...params,
    anchorX: rect.x + rect.width / 2,
    anchorY: rect.y + rect.height / 2,
    constrainRectHeight: true,
  });
}

function linesFitMaskAtAnchor(
  safeMask: Uint8Array,
  gw: number,
  gh: number,
  layout: WrappedLayout,
  anchorX: number,
  blockTop: number,
  lineHeight: number,
  samplePad: number
): boolean {
  let y = blockTop;
  for (const line of layout.lines) {
    if (!line.text.length) {
      y += lineHeight;
      continue;
    }
    const lineLeft = anchorX - line.widthPx / 2;
    const lineTop = y;
    const lineRight = lineLeft + line.widthPx;
    const lineBottom = lineTop + lineHeight;
    if (
      !bboxFullyInsideMask(
        safeMask,
        gw,
        gh,
        lineLeft,
        lineTop,
        lineRight,
        lineBottom,
        samplePad
      )
    ) {
      return false;
    }
    y += lineHeight;
  }
  return true;
}

export { DEFAULT_FONT };
