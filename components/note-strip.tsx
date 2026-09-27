"use client";

import { memo, useEffect, useRef } from "react";
import type { NoteGrade, NoteStatus } from "@/lib/practiceEngine";
import type { ScoreNote, ScoreTimeline } from "@/lib/scoreTimeline";

type Props = {
  timeline: ScoreTimeline;
  grades: NoteGrade[];
  currentNoteIndex: number;
};

const statusClass: Record<NoteStatus, string> = {
  pending: "border-transparent text-muted",
  current: "border-foreground bg-surface-muted text-foreground",
  good: "border-transparent bg-emerald-100 text-emerald-900",
  partial: "border-transparent bg-amber-100 text-amber-900",
  bad: "border-transparent bg-danger-soft text-danger",
  skipped: "border-transparent text-muted line-through",
};

function durationGlyph(beats: number, beatUnit: number) {
  const quarters = (beats * 4) / beatUnit;
  if (quarters >= 4) return "𝅝";
  if (quarters >= 3) return "𝅗𝅥.";
  if (quarters >= 2) return "𝅗𝅥";
  if (quarters >= 1.5) return "♩.";
  if (quarters >= 1) return "♩";
  if (quarters >= 0.75) return "♪.";
  if (quarters >= 0.5) return "♪";
  return "♬";
}

function describe(note: ScoreNote, grade: NoteGrade) {
  const lines = [`Measure ${note.measure} · ${note.isRest ? "rest" : note.name}`];
  if (note.dynamic) lines.push(`Marked ${note.dynamic}`);
  if (note.slurContinues) lines.push("Under a slur");
  if (note.slurStart) lines.push("Starts a slur");
  if (note.articulation) lines.push(`Wants ${note.articulation}`);
  if (grade.status === "pending" || grade.status === "current" || grade.status === "skipped") return lines.join("\n");
  if (note.isRest) {
    lines.push(grade.pitch.ok ? "Rest kept" : "Played through the rest");
    return lines.join("\n");
  }
  lines.push(
    grade.pitch.playedName
      ? `Heard ${grade.pitch.playedName} (${grade.pitch.cents! >= 0 ? "+" : ""}${grade.pitch.cents!.toFixed(0)}¢)${grade.pitch.ok ? "" : " ✗"}`
      : "No pitch heard ✗",
  );
  lines.push(
    grade.timing.deviationMs === null
      ? grade.timing.ok === null
        ? "No clear onset (short note, not counted)"
        : "No clear onset ✗"
      : `${grade.timing.deviationMs >= 0 ? "Late" : "Early"} ${Math.abs(grade.timing.deviationMs).toFixed(0)} ms${grade.timing.ok ? "" : " ✗"}`,
  );
  if (grade.dynamic.played) lines.push(`Played ${grade.dynamic.played}${grade.dynamic.ok === false ? ` (wanted ${grade.dynamic.expected}) ✗` : ""}`);
  if (grade.slur.expected && grade.slur.playedAttack !== null) {
    lines.push(grade.slur.ok ? (grade.slur.expected === "slurred" ? "Slurred" : "New bow") : grade.slur.expected === "slurred" ? "New bow where a slur was written ✗" : "Slurred into a note that wanted a new bow ✗");
  }
  if (grade.articulation.expected) {
    lines.push(
      grade.articulation.ok === true
        ? `Style ${grade.articulation.played}`
        : grade.articulation.ok === false
          ? `Wanted ${grade.articulation.expected}, heard ${grade.articulation.played ?? "nothing"} ✗`
          : "Style not measured",
    );
  }
  return lines.join("\n");
}

const NoteChip = memo(function NoteChip({ note, grade, beatUnit }: { note: ScoreNote; grade: NoteGrade; beatUnit: number }) {
  return (
    <span
      data-index={note.index}
      title={describe(note, grade)}
      className={`inline-flex shrink-0 select-none flex-col items-center rounded-md border-b-2 px-1.5 py-0.5 font-mono text-sm leading-tight transition-colors ${statusClass[grade.status]} ${note.slurContinues ? "italic" : ""}`}
    >
      <span>{note.isRest ? "·" : note.name}</span>
      <span className="text-[10px] opacity-70">
        {durationGlyph(note.durationBeats, beatUnit)}
        {note.dynamic && !note.slurContinues ? ` ${note.dynamic}` : ""}
      </span>
    </span>
  );
});

/* A monkeytype-style row of the score's notes. Each chip is colored as it is
   graded and the current note is highlighted while playing. */
export default function NoteStrip({ timeline, grades, currentNoteIndex }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || currentNoteIndex < 0) return;
    const chip = container.querySelector<HTMLElement>(`[data-index="${currentNoteIndex}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentNoteIndex]);

  return (
    <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:thin]">
      {timeline.notes.map((note, index) => {
        const separator = index === 0 || note.measure !== timeline.notes[index - 1].measure;
        return (
          <span key={note.index} className="flex shrink-0 items-center gap-1">
            {separator ? (
              <span className="mx-1 flex h-8 shrink-0 items-end border-l border-border-strong pl-1 text-[10px] tabular-nums text-muted">{note.measure}</span>
            ) : null}
            <NoteChip note={note} grade={grades[note.index]} beatUnit={timeline.beatUnit} />
          </span>
        );
      })}
    </div>
  );
}
