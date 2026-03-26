import { Suspense } from "react";

import { PngToolsWorkspace } from "@/components/png-tools-workspace";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-10 text-sm">
          Loading…
        </div>
      }
    >
      <PngToolsWorkspace />
    </Suspense>
  );
}
