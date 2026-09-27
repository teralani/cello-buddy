import type { BowMotionMetrics } from "@/lib/metrics";

/* Bow motion from the camera. The pose worker reports the right wrist
   (MediaPipe pose landmark 16) in frame coordinates; the practice screen
   stamps each report with score time and keeps it in a WristTrack. When a
   play-through finishes, the samples inside each measure are reduced to how
   level and how regular the bowing was: a good détaché moves the wrist back
   and forth along a near-horizontal line, once per bowed note.

   Positions are normalised to the frame height, so 0.1 is a tenth of the
   frame's height in either axis. The x axis is rescaled by the frame's
   aspect ratio first, so angles and distances are not squashed. */

export type WristSample = {
  /* Seconds of score time, 0 at the first downbeat after the count-in. */
  t: number;
  x: number;
  y: number;
};

export type PoseLandmark = { x: number; y: number; visibility?: number };

export const RIGHT_WRIST = 16;

/* Wrist detections below this visibility are ignored. */
const MIN_VISIBILITY = 0.5;
/* Sideways moves shorter than this do not count as a change of direction;
   it absorbs landmark jitter. */
const REVERSAL_THRESHOLD = 0.02;
/* Steps shorter than this are treated as jitter when measuring travel. */
const STEP_DEADBAND = 0.003;
const MIN_SAMPLES = 4;

export class WristTrack {
  private samples: WristSample[] = [];

  clear() {
    this.samples = [];
  }

  /* Adds one wrist report. `aspect` is frame width over height. Reports
     before the downbeat, with no score time, or with a poorly seen wrist
     are dropped. */
  push(landmark: PoseLandmark | undefined, aspect: number, t: number | null) {
    if (!landmark || t === null || t < 0) return;
    if (landmark.visibility !== undefined && landmark.visibility < MIN_VISIBILITY) return;
    this.samples.push({ t, x: landmark.x * aspect, y: landmark.y });
  }

  all(): WristSample[] {
    return this.samples;
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* Three-point moving average, enough to take the edge off landmark jitter
   at 15 frames per second without hiding a bow change. */
function smooth(values: number[]) {
  return values.map((value, index) => {
    const previous = values[index - 1] ?? value;
    const next = values[index + 1] ?? value;
    return (previous + value + next) / 3;
  });
}

/* Counts sideways direction changes with hysteresis: the wrist has to come
   back REVERSAL_THRESHOLD from its last extreme before a reversal counts. */
function countReversals(xs: number[]) {
  let direction = 0;
  let extreme = xs[0];
  let reversals = 0;
  for (const x of xs) {
    if (direction === 0) {
      if (x - extreme > REVERSAL_THRESHOLD) direction = 1;
      else if (extreme - x > REVERSAL_THRESHOLD) direction = -1;
      else continue;
      extreme = x;
    } else if (direction === 1) {
      if (x > extreme) extreme = x;
      else if (extreme - x > REVERSAL_THRESHOLD) {
        reversals += 1;
        direction = -1;
        extreme = x;
      }
    } else if (x < extreme) {
      extreme = x;
    } else if (x - extreme > REVERSAL_THRESHOLD) {
      reversals += 1;
      direction = 1;
      extreme = x;
    }
  }
  return reversals;
}

/* Tilt of the point cloud's main axis: 0 is horizontal, 90 is vertical. */
function pathAngleDeg(xs: number[], ys: number[]) {
  const meanX = mean(xs);
  const meanY = mean(ys);
  let varianceX = 0;
  let varianceY = 0;
  let covariance = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    varianceX += dx * dx;
    varianceY += dy * dy;
    covariance += dx * dy;
  }
  const radians = 0.5 * Math.atan2(2 * covariance, varianceX - varianceY);
  return Math.abs((radians * 180) / Math.PI);
}

/* Reduces the wrist samples between two score times to bow motion metrics,
   or null when the camera saw too little of the wrist in that window. */
export function analyzeBowMotion(samples: WristSample[], start: number, end: number): BowMotionMetrics | null {
  const window = samples.filter((sample) => sample.t >= start && sample.t < end);
  if (window.length < MIN_SAMPLES) return null;
  const xs = smooth(window.map((sample) => sample.x));
  const ys = smooth(window.map((sample) => sample.y));

  let horizontal = 0;
  let total = 0;
  for (let index = 1; index < xs.length; index += 1) {
    const dx = xs[index] - xs[index - 1];
    const dy = ys[index] - ys[index - 1];
    const step = Math.hypot(dx, dy);
    if (step < STEP_DEADBAND) continue;
    horizontal += Math.abs(dx);
    total += step;
  }

  /* With no travel above the deadband there is no line to measure. */
  const moved = total > 0;
  return {
    samples: window.length,
    pathAngleDeg: moved ? Math.round(pathAngleDeg(xs, ys)) : null,
    horizontalShare: moved ? Math.round((horizontal / total) * 100) / 100 : null,
    reversals: countReversals(xs),
    horizontalRangePct: Math.round((Math.max(...xs) - Math.min(...xs)) * 100),
    verticalRangePct: Math.round((Math.max(...ys) - Math.min(...ys)) * 100),
  };
}
