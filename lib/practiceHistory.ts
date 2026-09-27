import type { PracticeMetrics } from "@/lib/metrics";

/* One stored play-through: the summary of a PracticeMetrics record without
   its per-measure detail. This is the row the future database will hold per
   session, and the home dashboard is built entirely from a list of them.
   Every field maps to something the practice screen measures (lib/metrics.ts);
   a value the session could not measure stays null. */
export type PracticeHistoryEntry = {
  id: string;
  piece: string;
  /* ISO timestamp of when the play-through finished. */
  recordedAt: string;
  durationSeconds: number;
  completed: boolean;
  measuresPlayed: number;
  measuresInPiece: number;
  tempoTarget: number;
  tempoPlayed: number | null;
  gradedNotes: number;
  pitchAccuracyPct: number | null;
  meanAbsCents: number | null;
  timingAccuracyPct: number | null;
  meanAbsTimingMs: number | null;
  articulationAccuracyPct: number | null;
  slurAccuracyPct: number | null;
  dynamicAccuracyPct: number | null;
  /* Share of right-wrist travel that was sideways, 0 to 1. */
  bowHorizontalShare: number | null;
};

/* Flattens a finished session into its history row. The database write path
   should call this so stored rows and live metrics never drift apart. */
export function toHistoryEntry(metrics: PracticeMetrics, id: string): PracticeHistoryEntry {
  const { summary } = metrics;
  return {
    id,
    piece: metrics.piece,
    recordedAt: metrics.recordedAt,
    durationSeconds: metrics.durationSeconds,
    completed: metrics.completed,
    measuresPlayed: metrics.measures.length,
    measuresInPiece: metrics.measuresInPiece,
    tempoTarget: metrics.tempo.target,
    tempoPlayed: metrics.tempo.averagePlayed,
    gradedNotes: summary.gradedNotes,
    pitchAccuracyPct: summary.pitchAccuracyPct,
    meanAbsCents: summary.meanAbsCents,
    timingAccuracyPct: summary.timingAccuracyPct,
    meanAbsTimingMs: summary.meanAbsTimingMs,
    articulationAccuracyPct: summary.articulationAccuracyPct,
    slurAccuracyPct: summary.slurAccuracyPct,
    dynamicAccuracyPct: summary.dynamicAccuracyPct,
    bowHorizontalShare: summary.bow?.horizontalShare ?? null,
  };
}

/* ---------- Filler data ----------
   There is no database yet. fetchPracticeHistory resolves to a fixed set of
   sample sessions laid out over the four weeks before `now`, so the dashboard
   always has a populated "this week". Swap its body for a real query later;
   the dashboard only depends on the returned rows. */

type SamplePiece = { name: string; measures: number; tempo: number; notesPerMeasure: number; marked: boolean };

const PIECES: SamplePiece[] = [
  { name: "Prelude from Suite No. 1 (Bach)", measures: 41, tempo: 66, notesPerMeasure: 16, marked: false },
  { name: "The Swan (Saint-Saëns)", measures: 28, tempo: 60, notesPerMeasure: 6, marked: true },
  { name: "Minuet in G (Bach)", measures: 32, tempo: 72, notesPerMeasure: 5, marked: true },
];

/* [daysAgo, hour, piece index, measures played, pitch %, mean |cents|, timing %,
   mean |ms|, tempo played, articulation %, slur %, dynamics %, bow share] */
type SampleRow = [number, number, number, number, number, number, number, number, number, number | null, number | null, number | null, number];

const SAMPLE_ROWS: SampleRow[] = [
  /* The first weeks: a few short, rough sessions with long gaps. */
  [68, 20, 0, 9, 41, 44, 38, 236, 52, null, 45, null, 0.51],
  [66, 19, 0, 12, 44, 41, 40, 228, 53, null, 48, null, 0.53],
  [61, 20, 0, 16, 47, 39, 43, 221, 54, null, 50, null, 0.54],
  [59, 18, 0, 14, 46, 40, 45, 214, 55, null, 52, null, 0.55],
  [54, 19, 0, 22, 50, 37, 47, 209, 55, null, 54, null, 0.57],
  [52, 18, 2, 11, 52, 35, 49, 201, 66, 40, 55, 42, 0.58],
  [47, 20, 0, 41, 53, 34, 50, 198, 56, null, 57, null, 0.59],
  [45, 18, 2, 32, 55, 33, 52, 194, 67, 44, 58, 46, 0.6],
  [40, 19, 0, 41, 56, 32, 53, 190, 57, null, 59, null, 0.6],
  [38, 18, 0, 30, 57, 32, 52, 188, 57, null, 60, null, 0.61],
  [33, 19, 2, 32, 59, 30, 56, 181, 68, 49, 62, 51, 0.62],
  [31, 18, 0, 41, 58, 31, 55, 184, 58, null, 61, null, 0.62],
  [27, 19, 0, 18, 58, 31, 54, 182, 58, null, 61, null, 0.62],
  [26, 18, 0, 41, 61, 29, 57, 171, 59, null, 64, null, 0.64],
  [24, 20, 2, 32, 66, 26, 63, 158, 68, 55, 70, 58, 0.66],
  [23, 18, 0, 41, 64, 27, 60, 164, 61, null, 66, null, 0.65],
  [21, 19, 1, 14, 63, 28, 66, 149, 55, 52, 68, 60, 0.67],
  [20, 18, 1, 28, 67, 25, 69, 141, 57, 58, 72, 63, 0.69],
  [18, 19, 0, 41, 70, 23, 65, 152, 62, null, 71, null, 0.7],
  [17, 18, 2, 32, 74, 20, 71, 133, 70, 64, 76, 66, 0.72],
  [15, 20, 1, 28, 72, 22, 74, 126, 58, 63, 75, 68, 0.73],
  [13, 18, 0, 41, 75, 20, 70, 138, 63, null, 74, null, 0.74],
  [12, 19, 0, 41, 77, 18, 72, 131, 64, null, 77, null, 0.75],
  [10, 18, 2, 32, 80, 16, 78, 112, 71, 71, 81, 72, 0.77],
  [9, 19, 1, 28, 78, 18, 79, 108, 59, 69, 80, 74, 0.78],
  [7, 18, 0, 26, 76, 19, 73, 127, 63, null, 76, null, 0.76],
  [6, 18, 0, 41, 81, 15, 76, 119, 65, null, 79, null, 0.79],
  [4, 19, 1, 28, 83, 14, 82, 98, 60, 74, 84, 78, 0.81],
  [3, 18, 2, 32, 85, 13, 84, 92, 72, 78, 86, 80, 0.82],
  [2, 19, 0, 41, 84, 14, 79, 108, 65, null, 82, null, 0.81],
  [1, 18, 0, 41, 86, 12, 81, 101, 66, null, 84, null, 0.83],
  [1, 18, 1, 28, 85, 13, 85, 89, 60, 77, 87, 81, 0.84],
  [0, 17, 0, 41, 88, 11, 83, 96, 66, null, 85, null, 0.84],
];

export function buildSampleHistory(now: Date): PracticeHistoryEntry[] {
  const today = startOfDay(now);
  return SAMPLE_ROWS.map((row, index) => {
    const [daysAgo, hour, pieceIndex, measuresPlayed, pitch, cents, timing, ms, tempoPlayed, articulation, slur, dynamics, bowShare] = row;
    const piece = PIECES[pieceIndex];
    const at = new Date(today);
    at.setDate(today.getDate() - daysAgo);
    at.setHours(hour, 15 + ((index * 7) % 40), 0, 0);
    /* Four beats a measure at the played tempo, plus the count-in. */
    const durationSeconds = Math.round((measuresPlayed * 4 * 60) / tempoPlayed) + 4;
    return {
      id: `sample-${index}`,
      piece: piece.name,
      recordedAt: at.toISOString(),
      durationSeconds,
      completed: measuresPlayed >= piece.measures,
      measuresPlayed,
      measuresInPiece: piece.measures,
      tempoTarget: piece.tempo,
      tempoPlayed,
      gradedNotes: measuresPlayed * piece.notesPerMeasure,
      pitchAccuracyPct: pitch,
      meanAbsCents: cents,
      timingAccuracyPct: timing,
      meanAbsTimingMs: ms,
      articulationAccuracyPct: piece.marked ? articulation : null,
      slurAccuracyPct: slur,
      dynamicAccuracyPct: piece.marked ? dynamics : null,
      bowHorizontalShare: bowShare,
    };
  });
}

/* Newest first, like a database query ordered by recordedAt would return. */
export function fetchPracticeHistory(now = new Date()): Promise<PracticeHistoryEntry[]> {
  const rows = buildSampleHistory(now).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return Promise.resolve(rows);
}

/* ---------- Names ---------- */

/* "Prelude from Suite No. 1 (Bach)" without the composer, for tight tiles. */
export function briefPiece(piece: string): string {
  return piece.replace(/\s*\([^)]*\)\s*$/, "").trim() || piece;
}

/* ---------- Aggregations the dashboard shows ---------- */

export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000);
}

/* Sessions that finished in the `days` days ending at `now`, with `offset`
   whole periods stepped back (offset 1 is the period before). */
export function sessionsInWindow(history: PracticeHistoryEntry[], now: Date, days: number, offset = 0): PracticeHistoryEntry[] {
  const end = now.getTime() - offset * days * 86_400_000;
  const start = end - days * 86_400_000;
  return history.filter((entry) => {
    const t = new Date(entry.recordedAt).getTime();
    return t > start && t <= end;
  });
}

export function totalMinutes(entries: PracticeHistoryEntry[]): number {
  return Math.round(entries.reduce((sum, entry) => sum + entry.durationSeconds, 0) / 60);
}

/* Mean of a nullable measurement over the entries that measured it. */
export function meanOf(entries: PracticeHistoryEntry[], key: "pitchAccuracyPct" | "timingAccuracyPct" | "meanAbsCents" | "meanAbsTimingMs"): number | null {
  const values = entries.map((entry) => entry[key]).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/* Consecutive calendar days with at least one session, counting back from
   today or, if nothing was played yet today, from yesterday. */
export function streakDays(history: PracticeHistoryEntry[], now: Date): number {
  const played = new Set(history.map((entry) => daysBetween(new Date(entry.recordedAt), now)));
  let day = played.has(0) ? 0 : 1;
  let streak = 0;
  while (played.has(day)) {
    streak += 1;
    day += 1;
  }
  return streak;
}

export type DayTotal = { date: Date; minutes: number; sessions: number };

/* Practice time per calendar day for the last `days` days, oldest first. */
export function dailyTotals(history: PracticeHistoryEntry[], now: Date, days: number): DayTotal[] {
  const today = startOfDay(now);
  const totals: DayTotal[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    return { date, minutes: 0, sessions: 0 };
  });
  for (const entry of history) {
    const index = days - 1 - daysBetween(new Date(entry.recordedAt), now);
    if (index < 0 || index >= days) continue;
    totals[index].minutes += entry.durationSeconds / 60;
    totals[index].sessions += 1;
  }
  return totals.map((day) => ({ ...day, minutes: Math.round(day.minutes) }));
}

export type PieceSummary = {
  piece: string;
  sessions: number;
  lastPlayedAt: string;
  measuresInPiece: number;
  completions: number;
  /* Oldest and newest measured accuracy, to show how far the piece has come. */
  firstPitchPct: number | null;
  latestPitchPct: number | null;
  firstTimingPct: number | null;
  latestTimingPct: number | null;
};

export function summarizePieces(history: PracticeHistoryEntry[]): PieceSummary[] {
  const byPiece = new Map<string, PracticeHistoryEntry[]>();
  for (const entry of history) {
    const list = byPiece.get(entry.piece) ?? [];
    list.push(entry);
    byPiece.set(entry.piece, list);
  }
  return [...byPiece.entries()]
    .map(([piece, entries]) => {
      const ordered = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      const pitch = ordered.filter((e) => e.pitchAccuracyPct !== null);
      const timing = ordered.filter((e) => e.timingAccuracyPct !== null);
      return {
        piece,
        sessions: ordered.length,
        lastPlayedAt: ordered[ordered.length - 1].recordedAt,
        measuresInPiece: ordered[0].measuresInPiece,
        completions: ordered.filter((e) => e.completed).length,
        firstPitchPct: pitch[0]?.pitchAccuracyPct ?? null,
        latestPitchPct: pitch[pitch.length - 1]?.pitchAccuracyPct ?? null,
        firstTimingPct: timing[0]?.timingAccuracyPct ?? null,
        latestTimingPct: timing[timing.length - 1]?.timingAccuracyPct ?? null,
      };
    })
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

/* Whole days since the entry finished, 0 for today. */
export function daysSince(iso: string, now: Date): number {
  return daysBetween(new Date(iso), now);
}

/* Longest run of consecutive practice days anywhere in the history. */
export function longestStreak(history: PracticeHistoryEntry[], now: Date): number {
  const played = [...new Set(history.map((entry) => daysSince(entry.recordedAt, now)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < played.length; i += 1) {
    run = i > 0 && played[i] === played[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function totalNotes(history: PracticeHistoryEntry[]): number {
  return history.reduce((sum, entry) => sum + entry.gradedNotes, 0);
}

/* Which of the last `days` days had a session, oldest first. */
export function playedDays(history: PracticeHistoryEntry[], now: Date, days: number): { date: Date; played: boolean }[] {
  return dailyTotals(history, now, days).map((day) => ({ date: day.date, played: day.sessions > 0 }));
}

/* A calendar of the last `weeks` weeks as columns of seven days, oldest
   week first, each week running Monday to Sunday. Days after today, and any
   before the grid's first Monday, are null so the grid stays rectangular. */
export function weeklyCalendar(history: PracticeHistoryEntry[], now: Date, weeks: number): (DayTotal | null)[][] {
  const today = startOfDay(now);
  /* Days since the Monday of the current week (Monday = 0). */
  const sinceMonday = (today.getDay() + 6) % 7;
  const spanDays = (weeks - 1) * 7 + sinceMonday + 1;
  const totals = dailyTotals(history, now, spanDays);
  const columns: (DayTotal | null)[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    columns.push(
      Array.from({ length: 7 }, (_, d) => {
        const index = w * 7 + d;
        return index < totals.length ? totals[index] : null;
      }),
    );
  }
  return columns;
}

export type PersonalBest = {
  label: string;
  value: string;
  /* What the number means, e.g. the piece it was set on. */
  detail: string;
  recordedAt: string;
};

/* The best single-session figures on record, each tied to the session that
   set it, so the dashboard can say when a best is new. */
export function personalBests(history: PracticeHistoryEntry[], now: Date): PersonalBest[] {
  const bests: PersonalBest[] = [];
  const pick = <T extends PracticeHistoryEntry>(key: (e: T) => number | null, higherIsBetter: boolean) => {
    let best: T | null = null;
    let bestValue = higherIsBetter ? -Infinity : Infinity;
    for (const entry of history as T[]) {
      const value = key(entry);
      if (value === null) continue;
      if (higherIsBetter ? value > bestValue : value < bestValue) {
        best = entry;
        bestValue = value;
      }
    }
    return best;
  };

  const pitch = pick((e) => e.pitchAccuracyPct, true);
  if (pitch) bests.push({ label: "Best pitch", value: `${Math.round(pitch.pitchAccuracyPct!)}%`, detail: briefPiece(pitch.piece), recordedAt: pitch.recordedAt });
  const timing = pick((e) => e.timingAccuracyPct, true);
  if (timing) bests.push({ label: "Best timing", value: `${Math.round(timing.timingAccuracyPct!)}%`, detail: briefPiece(timing.piece), recordedAt: timing.recordedAt });
  const cents = pick((e) => e.meanAbsCents, false);
  if (cents) bests.push({ label: "Closest to pitch", value: `${Math.round(cents.meanAbsCents!)}¢ off`, detail: briefPiece(cents.piece), recordedAt: cents.recordedAt });
  const longest = pick((e) => e.durationSeconds, true);
  if (longest) {
    const m = Math.floor(longest.durationSeconds / 60);
    const s = longest.durationSeconds % 60;
    bests.push({ label: "Longest session", value: `${m}:${s.toString().padStart(2, "0")}`, detail: briefPiece(longest.piece), recordedAt: longest.recordedAt });
  }
  const streak = longestStreak(history, now);
  if (streak > 0) {
    const current = streakDays(history, now);
    bests.push({
      label: "Longest streak",
      value: `${streak} ${streak === 1 ? "day" : "days"}`,
      detail: current >= streak ? "That's the one you're on now" : `Current streak is ${current}`,
      recordedAt: current >= streak ? now.toISOString() : "",
    });
  }
  return bests;
}
