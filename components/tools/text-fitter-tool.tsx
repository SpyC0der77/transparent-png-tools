"use client";

import { useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  computeScaledDimensions,
  imageDataToOpaqueMask,
} from "@/lib/mask/alpha-mask";
import { buildSafeMask } from "@/lib/mask/safe-region";
import { largestRectangleInBinaryMatrix } from "@/lib/mask/largest-rectangle";
import type { Rectangle } from "@/lib/mask/largest-rectangle";
import { formatCanvasFont, getCanvasUiFontFamily } from "@/lib/canvas-font";
import { fitFontSizeAtAnchor } from "@/lib/text-fit/fit-font-size";
import { parseLineHeightPx } from "@/lib/text-fit/wrap-and-measure";
import { cn } from "@/lib/utils";

const MAX_LONG_EDGE = 1024;
const DEFAULT_TEXT =
  "Type here — text scales to stay inside the safe region (green tint) with your margin from the shape edge.";

function tintSafeRegion(
  data: Uint8ClampedArray,
  safe: Uint8Array,
  width: number,
  height: number
): void {
  for (let i = 0; i < width * height; i++) {
    if (!safe[i]) continue;
    const o = i * 4;
    data[o] = Math.min(255, Math.round(data[o]! * 0.78 + 34 * 0.22));
    data[o + 1] = Math.min(255, Math.round(data[o + 1]! * 0.78 + 197 * 0.22));
    data[o + 2] = Math.min(255, Math.round(data[o + 2]! * 0.78 + 94 * 0.22));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function canvasCoordsFromClient(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(r.width, 1);
  const sy = canvas.height / Math.max(r.height, 1);
  return {
    x: (clientX - r.left) * sx,
    y: (clientY - r.top) * sy,
  };
}

interface TextFitterToolProps {
  imageObjectUrl: string | null;
}

interface LayoutCache {
  key: string;
  safe: Uint8Array;
  rect: Rectangle | null;
  tinted: ImageData;
  w: number;
  h: number;
}

interface TextOffset {
  x: number;
  y: number;
}

export function TextFitterTool({ imageObjectUrl }: TextFitterToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutCacheRef = useRef<LayoutCache | null>(null);
  const prevCacheKeyRef = useRef<string | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startClient: { x: number; y: number };
    startOffset: TextOffset;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<TextOffset | null>(null);

  const [margin, setMargin] = useState(12);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [debouncedText, setDebouncedText] = useState(DEFAULT_TEXT);
  const [marginMax, setMarginMax] = useState(80);
  const [hint, setHint] = useState<string | null>(null);
  const [textOffset, setTextOffset] = useState<TextOffset>({ x: 0, y: 0 });
  const textOffsetRef = useRef<TextOffset>(textOffset);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    textOffsetRef.current = textOffset;
  }, [textOffset]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedText(text), 280);
    return () => window.clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (typeof document !== "undefined" && !measureCtxRef.current) {
      const c = document.createElement("canvas");
      c.width = 4;
      c.height = 4;
      measureCtxRef.current = c.getContext("2d");
    }
    const measureCtxMaybe = measureCtxRef.current;
    if (!canvas || !measureCtxMaybe) return;

    const measure2d: CanvasRenderingContext2D = measureCtxMaybe;
    const displayCanvas = canvas;

    const objectUrl = imageObjectUrl;
    if (!objectUrl) {
      layoutCacheRef.current = null;
      prevCacheKeyRef.current = null;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const imageSrc: string = objectUrl;
    let cancelled = false;

    async function run() {
      queueMicrotask(() => {
        if (!cancelled) setHint(null);
      });
      try {
        const img = await loadImage(imageSrc);
        if (cancelled) return;

        if (typeof document.fonts?.ready !== "undefined") {
          await document.fonts.ready;
        }
        if (cancelled) return;

        const { width: w, height: h } = computeScaledDimensions(
          img.naturalWidth,
          img.naturalHeight,
          MAX_LONG_EDGE
        );
        const maxM = Math.min(80, Math.max(0, Math.floor(Math.min(w, h) / 2)));
        if (cancelled) return;
        setMarginMax(maxM);
        setMargin((m) => Math.min(m, maxM));

        const cacheKey = `${imageSrc}:${Math.min(margin, maxM)}:${w}:${h}`;
        if (prevCacheKeyRef.current !== cacheKey) {
          prevCacheKeyRef.current = cacheKey;
          queueMicrotask(() => {
            setTextOffset({ x: 0, y: 0 });
          });
        }

        let cache = layoutCacheRef.current;

        if (!cache || cache.key !== cacheKey) {
          if (cancelled) return;
          displayCanvas.width = w;
          displayCanvas.height = h;
          const wctx = displayCanvas.getContext("2d");
          if (!wctx) return;
          wctx.clearRect(0, 0, w, h);
          wctx.drawImage(img, 0, 0, w, h);
          const base = wctx.getImageData(0, 0, w, h);
          const { mask } = imageDataToOpaqueMask(base);
          const effectiveMargin = Math.min(margin, maxM);
          const safe = buildSafeMask(mask, w, h, effectiveMargin);
          const rect = largestRectangleInBinaryMatrix(safe, w, h);
          const tinted = new ImageData(
            new Uint8ClampedArray(base.data),
            w,
            h
          );
          tintSafeRegion(tinted.data, safe, w, h);
          cache = {
            key: cacheKey,
            safe,
            rect,
            tinted,
            w,
            h,
          };
          layoutCacheRef.current = cache;
        }

        if (cancelled) return;
        if (!cache) return;
        const { safe, rect, tinted, w: cw, h: ch } = cache;

        displayCanvas.width = cw;
        displayCanvas.height = ch;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        if (cancelled) return;

        ctx.putImageData(tinted, 0, 0);

        if (!rect || rect.area === 0) {
          setHint(
            "No safe area at this margin — lower the margin or use a larger opaque region."
          );
          return;
        }

        const trimmed = debouncedText.trim();
        if (!trimmed) return;
        if (cancelled) return;

        const glyphPad = 2;
        const maxFont = Math.min(160, Math.floor(Math.min(rect.width, rect.height)));
        const fontFamily = getCanvasUiFontFamily();
        const baseCx = rect.x + rect.width / 2;
        const baseCy = rect.y + rect.height / 2;
        const anchorX = baseCx + textOffset.x;
        const anchorY = baseCy + textOffset.y;

        const fit = fitFontSizeAtAnchor({
          ctx: measure2d,
          text: trimmed,
          rect,
          safeMask: safe,
          maskWidth: cw,
          maskHeight: ch,
          fontFamily,
          minFontPx: 6,
          maxFontPx: Math.max(8, maxFont),
          glyphPadPx: glyphPad,
          anchorX,
          anchorY,
          constrainRectHeight: false,
        });

        if (!fit) {
          if (!cancelled) {
            setHint(
              "Text does not fit here — drag toward the green area, shorten the copy, or lower the margin."
            );
          }
          return;
        }

        if (cancelled) return;

        measure2d.font = formatCanvasFont(fit.fontSizePx, fontFamily);
        const lineHeight = parseLineHeightPx(measure2d);
        const blockHeight = lineHeight * fit.layout.lines.length;
        const blockTop = anchorY - blockHeight / 2;

        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.font = formatCanvasFont(fit.fontSizePx, fontFamily);
        const strokeW = Math.max(1, Math.round(fit.fontSizePx / 14));
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;

        let y = blockTop;
        for (const line of fit.layout.lines) {
          if (!line.text.length) {
            y += lineHeight;
            continue;
          }
          const x = anchorX - line.widthPx / 2;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.lineWidth = strokeW * 2;
          ctx.strokeText(line.text, x, y);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.fillText(line.text, x, y);
          y += lineHeight;
        }
      } catch {
        if (!cancelled) {
          setHint("Failed to process the image.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [imageObjectUrl, margin, debouncedText, textOffset]);

  function scheduleOffset(next: TextOffset) {
    pendingOffsetRef.current = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const p = pendingOffsetRef.current;
      if (p) setTextOffset(p);
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imageObjectUrl || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = canvasCoordsFromClient(e.clientX, e.clientY, e.currentTarget);
    dragRef.current = {
      active: true,
      startClient: { x: c.x, y: c.y },
      startOffset: { ...textOffsetRef.current },
    };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag?.active || !canvasRef.current) return;
    const c = canvasCoordsFromClient(e.clientX, e.clientY, e.currentTarget);
    const dx = c.x - drag.startClient.x;
    const dy = c.y - drag.startClient.y;
    scheduleOffset({
      x: drag.startOffset.x + dx,
      y: drag.startOffset.y + dy,
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.active) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        A distance transform finds how far each pixel is from transparency; the
        safe region keeps a disk of radius <strong>margin</strong> inside the
        shape. Text size adjusts so lines stay in the green;{" "}
        <strong>drag</strong> on the preview to move the block — it scales to
        stay inside the safe region.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="fit-text">Text</Label>
        <Textarea
          id="fit-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="min-h-28 resize-y"
          placeholder="Enter text to fit…"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="margin-slider">Margin (px)</Label>
          <span className="text-muted-foreground tabular-nums text-sm">
            {margin}
          </span>
        </div>
        <Slider
          id="margin-slider"
          value={[Math.min(margin, marginMax)]}
          min={0}
          max={marginMax}
          step={1}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v;
            setMargin(typeof n === "number" ? n : 0);
          }}
        />
      </div>

      <div className="bg-muted/40 ring-foreground/10 relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg ring-1">
        <canvas
          ref={canvasRef}
          className={cn(
            "max-h-[min(70vh,720px)] w-full touch-none object-contain select-none",
            imageObjectUrl && dragging ? "cursor-grabbing" : imageObjectUrl ? "cursor-grab" : undefined
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!imageObjectUrl ? (
          <p className="text-muted-foreground pointer-events-none absolute text-sm">
            Upload a PNG to preview
          </p>
        ) : null}
      </div>

      {imageObjectUrl && hint ? (
        <p className="text-destructive text-sm leading-relaxed" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
