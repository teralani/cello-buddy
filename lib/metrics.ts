/* Shape of the metrics JSON a practice session produces.
   The practice screen writes one of these under METRICS_KEY in sessionStorage
   when a play-through finishes, and the feedback page sends it to the chatbot.
   Every number is measured from the session itself: pitch and timing come
   from the microphone (lib/practiceEngine.ts), bow motion from the camera's
   right wrist track (lib/bowMotion.ts). Nothing here is estimated or sampled;
   a value that could not be measured is null. */

export const METRICS_KEY = "cello-buddy:metrics";

/* How the right wrist moved over a stretch of the piece, from the camera.
   Distances are fractions of the camera frame's height. */
export type BowMotionMetrics = {
  /* Wrist positions the camera delivered in this window. */
  samples: number;
  /* Tilt of the wrist's main line of travel, in degrees. 0 is level bowing,
     90 is straight up and down. null when the wrist barely moved. */
  pathAngleDeg: number | null;
  /* Share of the wrist's travel that was sideways, 0 to 1. null when the
     wrist barely moved. */
  horizontalShare: number | null;
  /* Times the wrist changed sideways direction: the bow changes seen. */
  reversals: number;
  /* Sideways and vertical extent of the wrist's path, as a percentage of
     the frame height. */
  horizontalRangePct: number;
  verticalRangePct: number;
};

export type MeasureMetrics = {
  /* Printed measure number. */
  number: number;
  /* Graded notes in the measure (rests excluded). */
  notes: number;
  /* Notes that start a new bow: every graded note not inside a slur. */
  bowedNotes: number;
  pitch: {
    /* Percentage of notes within the pitch tolerance. */
    accuracyPct: number | null;
    /* Signed mean error in cents. Positive is sharp. */
    meanCents: number | null;
    meanAbsCents: number | null;
    maxAbsCents: number | null;
    /* Notes where no pitch could be heard. */
    unheard: number;
  };
  timing: {
    /* Percentage of notes whose onset landed within the timing tolerance. */
    accuracyPct: number | null;
    /* Signed mean onset error in ms. Negative is early (rushed). */
    meanDeviationMs: number | null;
    meanAbsDeviationMs: number | null;
    /* Tempo actually played across this measure, from how its onsets were
       spaced against the written beats. */
    playedBpm: number | null;
    /* Notes with no onset found near the written beat. */
    unheard: number;
  };
  articulation: {
    /* Percentage of explicitly marked notes matching the detected style. */
    accuracyPct: number | null;
    /* Number of notes in this measure that carried a supported style mark. */
    checked: number;
  };
  /* null when the camera did not see the right wrist during this measure. */
  bow: BowMotionMetrics | null;
};

export type PracticeMetrics = {
  piece: string;
  recordedAt: string;
  durationSeconds: number;
  /* false when the student stopped before the end. measures then lists only
     what was played, out of measuresInPiece. */
  completed: boolean;
  measuresInPiece: number;
  tempo: {
    target: number;
    /* Tempo played over the whole piece, or null with too few timed notes. */
    averagePlayed: number | null;
  };
  summary: {
    gradedNotes: number;
    pitchAccuracyPct: number | null;
    meanAbsCents: number | null;
    timingAccuracyPct: number | null;
    meanAbsTimingMs: number | null;
    /* Only graded where the score carries dynamics or slurs. */
    dynamicAccuracyPct: number | null;
    slurAccuracyPct: number | null;
    articulationAccuracyPct: number | null;
    /* Right wrist motion over the whole play-through. */
    bow: BowMotionMetrics | null;
  };
  measures: MeasureMetrics[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPracticeMetrics(value: unknown): value is PracticeMetrics {
  if (!isRecord(value)) return false;
  return (
    typeof value.piece === "string" &&
    isRecord(value.tempo) &&
    typeof value.tempo.target === "number" &&
    isRecord(value.summary) &&
    (typeof value.summary.articulationAccuracyPct === "number" || value.summary.articulationAccuracyPct === null) &&
    Array.isArray(value.measures) &&
    value.measures.every(
      (measure) =>
        isRecord(measure) &&
        typeof measure.number === "number" &&
        isRecord(measure.pitch) &&
        isRecord(measure.timing) &&
        isRecord(measure.articulation) &&
        (typeof measure.articulation.accuracyPct === "number" || measure.articulation.accuracyPct === null) &&
        typeof measure.articulation.checked === "number",
    )
  );
}
