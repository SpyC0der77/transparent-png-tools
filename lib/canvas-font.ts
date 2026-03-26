/**
 * Canvas 2D `font` parsing is picky: invalid strings fall back to a default
 * that is often serif. Use explicit weight/style and a stack that always ends
 * with `sans-serif`.
 */

const CANVAS_SANS_FALLBACK =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

/**
 * Prefer the resolved stack from `document.body` (Geist via next/font), and
 * ensure the list ends with the `sans-serif` generic so the canvas never uses
 * the UA serif fallback.
 */
export function getCanvasUiFontFamily(): string {
  if (typeof document === "undefined") {
    return CANVAS_SANS_FALLBACK;
  }

  const fromBody = getComputedStyle(document.body).fontFamily.trim();
  if (fromBody.length > 0) {
    if (/\bsans-serif\s*$/i.test(fromBody)) return fromBody;
    return `${fromBody}, sans-serif`;
  }

  const fromVar = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-geist-sans")
    .trim();
  if (fromVar.length > 0) {
    return `${fromVar}, ui-sans-serif, system-ui, sans-serif`;
  }

  return CANVAS_SANS_FALLBACK;
}

/** Valid canvas font string with explicit weight (avoids ambiguous shorthand). */
export function formatCanvasFont(sizePx: number, fontFamilyStack: string): string {
  return `normal 400 ${sizePx}px ${fontFamilyStack}`;
}
