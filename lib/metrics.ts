/* Shape of the metrics JSON a practice session produces.
   The recorder writes one of these under METRICS_KEY in sessionStorage,
   and the feedback page sends it to the chatbot. */

export const METRICS_KEY = "cello-buddy:metrics";

export type PostureFlag =
  | "shoulder_elevated"
  | "head_tilted"
  | "wrist_collapsed"
  | "elbow_low"
  | "slouched";

export type MeasureMetrics = {
  number: number;
  notes: number;
  /* Signed mean pitch error in cents. Positive is sharp. */
  intonationMeanCents: number;
  /* Largest absolute pitch error in the measure, in cents. */
  intonationMaxAbsCents: number;
  /* Signed timing error against the score in ms. Positive is late, negative is rushed. */
  timingDeviationMs: number;
  /* Variance of the bow angle relative to perpendicular, in degrees squared. */
  bowAngleVarianceDeg: number;
  /* Signed drift of the contact point in mm. Positive is toward the fingerboard. */
  contactPointDriftMm: number;
  postureFlags: PostureFlag[];
};

export type PracticeMetrics = {
  piece: string;
  recordedAt: string;
  durationSeconds: number;
  tempo: {
    target: number;
    averagePlayed: number;
  };
  summary: {
    intonationMeanAbsCents: number;
    timingMeanAbsMs: number;
    bowAngleVarianceDeg: number;
    contactPointDriftMm: number;
    postureFlags: PostureFlag[];
  };
  measures: MeasureMetrics[];
};

function measure(
  number: number,
  overrides: Partial<Omit<MeasureMetrics, "number">> = {},
): MeasureMetrics {
  return {
    number,
    notes: 4,
    intonationMeanCents: 3,
    intonationMaxAbsCents: 9,
    timingDeviationMs: -8,
    bowAngleVarianceDeg: 4,
    contactPointDriftMm: 1,
    postureFlags: [],
    ...overrides,
  };
}

/* A realistic session with a few clear problems so the chatbot has something
   concrete to say: sharp intonation in measures 5 to 8, bow drifting toward
   the fingerboard in 9 to 12, a rushed tempo throughout, and a raised right
   shoulder late in the piece. Used until the real recorder exists. */
export const sampleMetrics: PracticeMetrics = {
  piece: "Untitled score",
  recordedAt: "2026-09-25T18:30:00.000Z",
  durationSeconds: 58,
  tempo: { target: 72, averagePlayed: 79 },
  summary: {
    intonationMeanAbsCents: 14,
    timingMeanAbsMs: 31,
    bowAngleVarianceDeg: 11,
    contactPointDriftMm: 6,
    postureFlags: ["shoulder_elevated"],
  },
  measures: [
    measure(1),
    measure(2),
    measure(3, { timingDeviationMs: -18 }),
    measure(4, { timingDeviationMs: -22 }),
    measure(5, { intonationMeanCents: 22, intonationMaxAbsCents: 38, notes: 6 }),
    measure(6, { intonationMeanCents: 27, intonationMaxAbsCents: 44, notes: 6 }),
    measure(7, { intonationMeanCents: 19, intonationMaxAbsCents: 35, notes: 6 }),
    measure(8, { intonationMeanCents: 24, intonationMaxAbsCents: 41, notes: 6 }),
    measure(9, { bowAngleVarianceDeg: 18, contactPointDriftMm: 9 }),
    measure(10, { bowAngleVarianceDeg: 24, contactPointDriftMm: 14 }),
    measure(11, { bowAngleVarianceDeg: 27, contactPointDriftMm: 17 }),
    measure(12, { bowAngleVarianceDeg: 21, contactPointDriftMm: 12 }),
    measure(13, { timingDeviationMs: -40, postureFlags: ["shoulder_elevated"] }),
    measure(14, { timingDeviationMs: -52, postureFlags: ["shoulder_elevated"] }),
    measure(15, { timingDeviationMs: -47, postureFlags: ["shoulder_elevated"] }),
    measure(16, { timingDeviationMs: -12, notes: 2 }),
  ],
};

export function isPracticeMetrics(value: unknown): value is PracticeMetrics {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.piece === "string" &&
    typeof v.tempo === "object" &&
    v.tempo !== null &&
    typeof v.summary === "object" &&
    v.summary !== null &&
    Array.isArray(v.measures)
  );
}
