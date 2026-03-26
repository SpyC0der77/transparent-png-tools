"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  computeScaledDimensions,
  imageDataToOpaqueMask,
} from "@/lib/mask/alpha-mask";
import { applyBorderToImageData, type BorderPlacement } from "@/lib/mask/apply-border";
import { cn } from "@/lib/utils";

const MAX_LONG_EDGE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) {
    return { r: 0, g: 0, b: 0, a: 255 };
  }
  const n = Number.parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: 255,
  };
}

interface BorderToolProps {
  imageObjectUrl: string | null;
}

export function BorderTool({ imageObjectUrl }: BorderToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [widthPx, setWidthPx] = useState(8);
  const [color, setColor] = useState("#0a0a0a");
  const [placement, setPlacement] = useState<BorderPlacement>("outside");
  const [hint, setHint] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!imageObjectUrl) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const displayCanvas: HTMLCanvasElement = canvas;
    const objectUrl = imageObjectUrl;
    let cancelled = false;

    async function run() {
      queueMicrotask(() => {
        if (!cancelled) {
          setHint(null);
          setExportReady(false);
        }
      });
      try {
        const img = await loadImage(objectUrl);
        if (cancelled) return;

        const { width: w, height: h } = computeScaledDimensions(
          img.naturalWidth,
          img.naturalHeight,
          MAX_LONG_EDGE
        );

        const work = document.createElement("canvas");
        work.width = w;
        work.height = h;
        const wctx = work.getContext("2d");
        if (!wctx) return;
        wctx.drawImage(img, 0, 0, w, h);
        const source = wctx.getImageData(0, 0, w, h);
        const { mask } = imageDataToOpaqueMask(source);

        let opaqueCount = 0;
        for (let i = 0; i < mask.length; i++) {
          if (mask[i]) opaqueCount++;
        }
        if (opaqueCount === 0) {
          if (!cancelled) {
            setHint("No opaque pixels — use a PNG with visible content.");
          }
          return;
        }

        const rgba = hexToRgba(color);
        const bordered = applyBorderToImageData(
          source,
          mask,
          widthPx,
          placement,
          rgba
        );

        if (cancelled) return;
        displayCanvas.width = bordered.width;
        displayCanvas.height = bordered.height;
        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.putImageData(bordered, 0, 0);
        setExportReady(true);
      } catch {
        if (!cancelled) setHint("Failed to process the image.");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [imageObjectUrl, widthPx, color, placement]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bordered.png";
      a.click();
      queueMicrotask(() => URL.revokeObjectURL(a.href));
    }, "image/png");
  }

  const maxWidth = 48;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        <strong>Outside</strong> grows the canvas and draws the stroke in
        transparent space around the shape. <strong>Inside</strong> eats into
        the opaque edge by the border thickness.
      </p>

      <div className="flex flex-wrap gap-2">
        <span className="text-muted-foreground w-full text-xs font-medium">
          Placement
        </span>
        <Button
          type="button"
          size="sm"
          variant={placement === "outside" ? "default" : "outline"}
          onClick={() => setPlacement("outside")}
        >
          Outside
        </Button>
        <Button
          type="button"
          size="sm"
          variant={placement === "inside" ? "default" : "outline"}
          onClick={() => setPlacement("inside")}
        >
          Inside
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="border-color">Border color</Label>
        <div className="flex items-center gap-3">
          <input
            id="border-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border-input size-10 cursor-pointer rounded-md border bg-transparent p-0"
            aria-label="Border color"
          />
          <span className="text-muted-foreground font-mono text-xs">
            {color}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="border-width">Thickness (px)</Label>
          <span className="text-muted-foreground tabular-nums text-sm">
            {widthPx}
          </span>
        </div>
        <Slider
          id="border-width"
          value={[widthPx]}
          min={1}
          max={maxWidth}
          step={1}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v;
            setWidthPx(typeof n === "number" ? n : 1);
          }}
        />
      </div>

      <div
        className={cn(
          "bg-muted/40 ring-foreground/10 relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg ring-1",
          placement === "outside" && "p-2"
        )}
      >
        <canvas
          ref={canvasRef}
          className="max-h-[min(70vh,720px)] w-full object-contain"
        />
        {!imageObjectUrl ? (
          <p className="text-muted-foreground pointer-events-none absolute text-sm">
            Upload a PNG to preview
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          disabled={!exportReady || !imageObjectUrl}
          onClick={downloadPng}
        >
          <Download className="size-4" />
          Download PNG
        </Button>
      </div>

      {imageObjectUrl && hint ? (
        <p className="text-destructive text-sm leading-relaxed" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
