export interface TextLine {
  text: string;
  widthPx: number;
}

export interface WrappedLayout {
  lines: TextLine[];
  totalHeightPx: number;
  maxLineWidthPx: number;
}

/**
 * Word-wrap plain text to maxWidth using canvas 2d measureText (must set font on ctx first).
 */
export function wrapTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): WrappedLayout {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized || maxWidthPx <= 0) {
    return { lines: [], totalHeightPx: 0, maxLineWidthPx: 0 };
  }

  const lineHeightPx = parseLineHeightPx(ctx);
  const lines: TextLine[] = [];
  const paragraphs = normalized.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push({ text: "", widthPx: 0 });
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    function flushLine() {
      if (!line.length) return;
      lines.push({ text: line, widthPx: ctx.measureText(line).width });
      line = "";
    }

    for (const word of words) {
      const trial = line.length ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidthPx) {
        line = trial;
        continue;
      }
      flushLine();
      if (ctx.measureText(word).width <= maxWidthPx) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        const next = chunk + ch;
        if (ctx.measureText(next).width > maxWidthPx && chunk.length) {
          lines.push({
            text: chunk,
            widthPx: ctx.measureText(chunk).width,
          });
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      line = chunk;
    }
    flushLine();
  }

  const nonEmpty = lines.filter((l) => l.text.length > 0);
  const maxLineWidthPx = nonEmpty.reduce(
    (m, l) => Math.max(m, l.widthPx),
    0
  );
  const totalHeightPx = lineHeightPx * lines.length;

  return { lines, totalHeightPx, maxLineWidthPx };
}

export function parseLineHeightPx(ctx: CanvasRenderingContext2D): number {
  const raw = ctx.font;
  const match = /(\d+(?:\.\d+)?)px/.exec(raw);
  if (match) return Number(match[1]);
  return 16;
}
