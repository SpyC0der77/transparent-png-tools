"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Frame, ImageIcon, Type, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BorderTool } from "@/components/tools/border-tool";
import { TextFitterTool } from "@/components/tools/text-fitter-tool";
import { cn } from "@/lib/utils";

type ToolId = "text-fitter" | "border" | "coming-b";

const TOOLS: {
  id: ToolId;
  title: string;
  description: string;
  icon: typeof Type;
  available: boolean;
}[] = [
  {
    id: "text-fitter",
    title: "Text fitter",
    description: "Inset by margin from the alpha edge, then fit text inside.",
    icon: Type,
    available: true,
  },
  {
    id: "border",
    title: "Border",
    description: "Stroke around the shape — outside or inside the alpha edge.",
    icon: Frame,
    available: true,
  },
  {
    id: "coming-b",
    title: "Batch export",
    description: "Coming soon.",
    icon: Wand2,
    available: false,
  },
];

function isPngFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".png")) return false;
  if (file.type && file.type !== "image/png") return false;
  return true;
}

export function PngToolsWorkspace() {
  const inputId = useId();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId>("text-fitter");
  const [isDragging, setIsDragging] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const revokeCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const setFileFromBlob = useCallback(
    (file: File) => {
      if (!isPngFile(file)) {
        setError("Please choose a PNG file with transparency.");
        return;
      }
      setError(null);
      revokeCurrentUrl();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setObjectUrl(url);
      setFileName(file.name);
    },
    [revokeCurrentUrl]
  );

  useEffect(() => {
    return () => {
      revokeCurrentUrl();
    };
  }, [revokeCurrentUrl]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileFromBlob(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFileFromBlob(file);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Transparent PNG tools
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Upload a transparent PNG, pick a tool, and work in the preview.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Image</CardTitle>
              <CardDescription>
                PNG only. Preview is used by the active tool.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={inputId}>File</Label>
                <Input
                  id={inputId}
                  type="file"
                  accept="image/png,.png"
                  onChange={onInputChange}
                  className="cursor-pointer"
                />
              </div>

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById(inputId)?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
                onDrop={onDrop}
                className={cn(
                  "border-border flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors",
                  isDragging && "bg-muted/60 border-primary/40",
                  !isDragging && "hover:bg-muted/30"
                )}
              >
                <ImageIcon className="text-muted-foreground size-8" />
                <p className="text-muted-foreground text-sm">
                  Drag and drop a PNG here, or use the file input above.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(inputId)?.click()}
                >
                  Browse
                </Button>
              </div>

              {fileName ? (
                <p className="text-muted-foreground truncate text-xs">
                  Loaded: {fileName}
                </p>
              ) : null}

              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              {objectUrl ? (
                <div className="bg-muted/40 ring-foreground/10 overflow-hidden rounded-lg ring-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={objectUrl}
                    alt="Uploaded PNG preview"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-foreground mb-3 text-sm font-medium">
              Tools
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const selected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={!tool.available}
                    onClick={() => {
                      if (tool.available) setActiveTool(tool.id);
                    }}
                    className={cn(
                      "ring-foreground/10 flex flex-col items-start gap-2 rounded-xl border border-transparent bg-card p-4 text-left ring-1 transition-colors",
                      tool.available &&
                        "hover:bg-muted/40 cursor-pointer hover:border-border",
                      !tool.available && "cursor-not-allowed opacity-50",
                      selected &&
                        tool.available &&
                        "border-primary/30 ring-primary/25 bg-muted/20"
                    )}
                  >
                    <Icon className="size-5 shrink-0 opacity-80" />
                    <span className="text-sm font-medium">{tool.title}</span>
                    <span className="text-muted-foreground text-xs leading-snug">
                      {tool.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {TOOLS.find((t) => t.id === activeTool)?.title ?? "Tool"}
              </CardTitle>
              <CardDescription>
                {activeTool === "text-fitter"
                  ? "Margin is measured in preview pixels (after scaling to 1024px on the long edge)."
                  : activeTool === "border"
                    ? "Border thickness is in preview pixels (long edge capped at 1024px)."
                    : "This tool is not available yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTool === "text-fitter" ? (
                <TextFitterTool imageObjectUrl={objectUrl} />
              ) : activeTool === "border" ? (
                <BorderTool imageObjectUrl={objectUrl} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Pick an available tool from the grid.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
