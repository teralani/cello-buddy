import {
  BOW_MARKER_ID,
  detectMarkerInImage,
  markerSize,
  transformMarker,
  type BowMarker,
} from "@/lib/bowMarker";

/* Finds the bow's ArUco marker in full-resolution camera frames, off the main
   thread. Two search modes:

   - Window search: once the marker has been seen, only a region around its
     last position is analysed, rescaled so the marker spans one of the
     TARGET_SIZES. Rescaling matters more than resolution: a 15 px blurry
     marker gets enlarged so its cells are wide enough for the detector, while
     a 300 px marker close to the lens gets shrunk, which also tightens motion
     blur. Each target is tried in turn, and the window grows after misses
     because a bow can travel a long way between frames.
   - Full search: when there is no recent position, the whole frame is scanned
     at native resolution. This is slower (roughly 100 ms for 720p) but only
     runs until the marker is picked up again.

   The last good position is reported for a few misses so the overlay does not
   flicker when a single frame fails. */

export type MarkerWorkerInput = { type: "frame"; bitmap: ImageBitmap; markerId?: number };
export type MarkerWorkerOutput = {
  type: "marker";
  /* Marker in frame pixels, or null. `fresh` is false when it is a held-over
     position from a recent frame rather than a detection in this one. */
  marker: BowMarker | null;
  fresh: boolean;
  frameWidth: number;
  frameHeight: number;
  /* Detection time in ms, handy when tuning. */
  elapsed: number;
  /* Set when detection threw; the frame counts as a miss. */
  error?: string;
};

/* Marker sizes (px) the window is rescaled to, tried in order. 56 suits small
   far markers, 96 keeps more detail for large or motion-blurred ones, and the
   middle step covers a marker whose size changed a lot since the last frame. */
const TARGET_SIZES = [56, 72, 96];
const MAX_ZOOM = 6;
const MIN_ZOOM = 0.2;
/* Frames the last position is reported after detection stops succeeding. */
const HOLD_FRAMES = 3;

let frameCanvas: OffscreenCanvas | null = null;
let windowCanvas: OffscreenCanvas | null = null;
let last: BowMarker | null = null;
let misses = 0;

function canvasFor(current: OffscreenCanvas | null, width: number, height: number) {
  if (current && current.width === width && current.height === height) return current;
  return new OffscreenCanvas(width, height);
}

function context(canvas: OffscreenCanvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
  return ctx;
}

function searchFull(bitmap: ImageBitmap, markerId: number) {
  frameCanvas = canvasFor(frameCanvas, bitmap.width, bitmap.height);
  const ctx = context(frameCanvas);
  ctx.drawImage(bitmap, 0, 0);
  return detectMarkerInImage(ctx.getImageData(0, 0, bitmap.width, bitmap.height), markerId);
}

/* Crops a square around the previous position and rescales it so the marker
   is `target` px across, then maps any detection back to frame pixels. */
function searchWindow(bitmap: ImageBitmap, previous: BowMarker, markerId: number, target: number, grow: number) {
  const size = Math.max(8, markerSize(previous));
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target / size));
  const half = Math.max(size * 2.5, 60) * grow;
  const left = Math.max(0, Math.floor(previous.center.x - half));
  const top = Math.max(0, Math.floor(previous.center.y - half));
  const width = Math.min(bitmap.width - left, Math.ceil(half * 2));
  const height = Math.min(bitmap.height - top, Math.ceil(half * 2));
  if (width < 16 || height < 16) return null;

  const outWidth = Math.max(1, Math.round(width * zoom));
  const outHeight = Math.max(1, Math.round(height * zoom));
  windowCanvas = canvasFor(windowCanvas, outWidth, outHeight);
  const ctx = context(windowCanvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, left, top, width, height, 0, 0, outWidth, outHeight);
  const found = detectMarkerInImage(ctx.getImageData(0, 0, outWidth, outHeight), markerId);
  return found ? transformMarker(found, 1 / zoom, 1 / zoom, left * zoom, top * zoom) : null;
}

self.onmessage = ({ data }: MessageEvent<MarkerWorkerInput>) => {
  if (data.type !== "frame" || !data.bitmap) return;
  const { bitmap } = data;
  /* Read the size first: a closed ImageBitmap reports 0 x 0. */
  const frameWidth = bitmap.width;
  const frameHeight = bitmap.height;
  const markerId = data.markerId ?? BOW_MARKER_ID;
  const started = performance.now();
  let found: BowMarker | null = null;
  let error: string | undefined;
  try {
    if (last) {
      const grow = 1 + misses * 0.5;
      for (const target of TARGET_SIZES) {
        found = searchWindow(bitmap, last, markerId, target, grow);
        if (found) break;
      }
    }
    if (!found) found = searchFull(bitmap, markerId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    bitmap.close();
  }

  if (found) {
    last = found;
    misses = 0;
  } else if (last && ++misses > HOLD_FRAMES) {
    last = null;
  }

  /* Always reply, even on failure, so the sender can release the next frame. */
  const output: MarkerWorkerOutput = {
    type: "marker",
    marker: found ?? last,
    fresh: found !== null,
    frameWidth,
    frameHeight,
    elapsed: performance.now() - started,
    error,
  };
  postMessage(output);
};
