# Transparent PNG Tools

Two browser tools for working with the opaque shape of a transparent PNG: add a border around its silhouette or fit text inside it.

## What it does

- Upload a PNG and switch between Border and Text fitter.
- Add an outside border that expands the canvas, or an inside border that erodes the edge.
- Adjust border color and thickness, then download `bordered.png`.
- Fit wrapped text inside an alpha-derived safe region with an adjustable margin.
- Drag the text block in the preview to reposition it.

## Run locally

Use Node.js 20.9+ and Bun.

```bash
git clone https://github.com/SpyC0der77/transparent-png-tools.git
cd transparent-png-tools
bun install --frozen-lockfile
bun run dev
```

Open [localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Build the production app |
| `bun run start` | Serve a production build |
| `bun run lint` | Run ESLint |

Run `build` before `start`.

## Dependencies and limitations

Image processing uses browser canvas and local object URLs. These tools do not upload the image to an API. Text fitter provides an interactive preview; the PNG download action is implemented in Border.

## Source layout

- [`components/png-tools-workspace.tsx`](components/png-tools-workspace.tsx): Upload and tool selection.
- [`components/tools/`](components/tools/): Border and text fitting interfaces.
- [`lib/mask/`](lib/mask/): Alpha masks, morphology, and safe regions.
- [`lib/text-fit/`](lib/text-fit/): Text wrapping and font sizing.
