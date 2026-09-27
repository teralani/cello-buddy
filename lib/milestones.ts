import { briefPiece, longestStreak, totalNotes, type PracticeHistoryEntry } from "@/lib/practiceHistory";

/* Small notation-style marks the milestone chips are drawn with. */
export type MilestoneGlyph = "note" | "notes" | "repeat" | "fork" | "fermata" | "metronome" | "bow" | "tally" | "sheets";

export type Milestone = {
  id: string;
  title: string;
  glyph: MilestoneGlyph;
  earned: boolean;
  /* What earned it, or what is still needed. */
  detail: string;
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function best(history: PracticeHistoryEntry[], key: (entry: PracticeHistoryEntry) => number | null, higherIsBetter = true): PracticeHistoryEntry | null {
  let top: PracticeHistoryEntry | null = null;
  let topValue = higherIsBetter ? -Infinity : Infinity;
  for (const entry of history) {
    const value = key(entry);
    if (value === null) continue;
    if (higherIsBetter ? value > topValue : value < topValue) {
      top = entry;
      topValue = value;
    }
  }
  return top;
}

/* Every milestone is decided from measured session data, never estimated.
   Locked ones say how far off they are so there is always a next target. */
export function milestones(history: PracticeHistoryEntry[], now: Date): Milestone[] {
  const oldest = history[history.length - 1];
  const completed = history.filter((e) => e.completed);
  const pitch = best(history, (e) => e.pitchAccuracyPct);
  const cents = best(history, (e) => e.meanAbsCents, false);
  const timing = best(history, (e) => e.timingAccuracyPct);
  const bow = best(history, (e) => e.bowHorizontalShare);
  const articulation = best(history, (e) => e.articulationAccuracyPct);
  const streak = longestStreak(history, now);
  const notes = totalNotes(history);
  const pieces = new Set(history.map((e) => e.piece)).size;

  return [
    {
      id: "first-session",
      title: "First bow",
      glyph: "note",
      earned: Boolean(oldest),
      detail: oldest ? `Your first session, ${longDate(oldest.recordedAt)}` : "Record a session",
    },
    {
      id: "whole-piece",
      title: "Start to finish",
      glyph: "repeat",
      earned: completed.length > 0,
      detail: completed.length > 0 ? `${completed.length} complete play-throughs` : "Play a piece to the last measure",
    },
    {
      id: "in-tune",
      title: "In tune",
      glyph: "fork",
      earned: (pitch?.pitchAccuracyPct ?? 0) >= 80,
      detail: pitch ? (pitch.pitchAccuracyPct! >= 80 ? `${Math.round(pitch.pitchAccuracyPct!)}% on ${briefPiece(pitch.piece)}` : `Best so far ${Math.round(pitch.pitchAccuracyPct!)}%, need 80%`) : "Hit 80% of notes in tune",
    },
    {
      id: "close-cents",
      title: "Within 15 cents",
      glyph: "fermata",
      earned: (cents?.meanAbsCents ?? Infinity) <= 15,
      detail: cents ? (cents.meanAbsCents! <= 15 ? `${Math.round(cents.meanAbsCents!)}¢ off on ${briefPiece(cents.piece)}` : `Closest so far ${Math.round(cents.meanAbsCents!)}¢`) : "Average under 15¢ off across a session",
    },
    {
      id: "on-the-beat",
      title: "On the beat",
      glyph: "metronome",
      earned: (timing?.timingAccuracyPct ?? 0) >= 80,
      detail: timing ? (timing.timingAccuracyPct! >= 80 ? `${Math.round(timing.timingAccuracyPct!)}% on ${briefPiece(timing.piece)}` : `Best so far ${Math.round(timing.timingAccuracyPct!)}%, need 80%`) : "Land 80% of onsets on time",
    },
    {
      id: "steady-bow",
      title: "Straight bow",
      glyph: "bow",
      earned: (bow?.bowHorizontalShare ?? 0) >= 0.8,
      detail: bow ? (bow.bowHorizontalShare! >= 0.8 ? `${Math.round(bow.bowHorizontalShare! * 100)}% sideways travel` : `Best so far ${Math.round(bow.bowHorizontalShare! * 100)}%, need 80%`) : "Keep 80% of bow travel sideways",
    },
    {
      id: "marked-up",
      title: "As written",
      glyph: "sheets",
      earned: (articulation?.articulationAccuracyPct ?? 0) >= 75,
      detail: articulation
        ? articulation.articulationAccuracyPct! >= 75
          ? `${Math.round(articulation.articulationAccuracyPct!)}% of markings on ${briefPiece(articulation.piece)}`
          : `Best so far ${Math.round(articulation.articulationAccuracyPct!)}%, need 75%`
        : "Match 75% of a score's style markings",
    },
    {
      id: "week-streak",
      title: "Seven in a row",
      glyph: "tally",
      earned: streak >= 7,
      detail: streak >= 7 ? `Longest run: ${streak} days` : `${7 - streak} more ${7 - streak === 1 ? "day" : "days"} on your longest run`,
    },
    {
      id: "thousand-notes",
      title: "A thousand notes",
      glyph: "notes",
      earned: notes >= 1000,
      detail: notes >= 1000 ? `${notes.toLocaleString()} graded so far` : `${(1000 - notes).toLocaleString()} to go`,
    },
    {
      id: "ten-thousand-notes",
      title: "Ten thousand notes",
      glyph: "notes",
      earned: notes >= 10_000,
      detail: notes >= 10_000 ? `${notes.toLocaleString()} graded so far` : `${(10_000 - notes).toLocaleString()} to go`,
    },
    {
      id: "repertoire",
      title: "Three pieces",
      glyph: "sheets",
      earned: pieces >= 3,
      detail: pieces >= 3 ? `${pieces} in rotation` : `${3 - pieces} more ${3 - pieces === 1 ? "piece" : "pieces"}`,
    },
  ];
}
