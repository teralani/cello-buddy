import type { Note, OpenSheetMusicDisplay, VoiceEntry } from "opensheetmusicdisplay";
import { ArticulationEnum, MusicPartManagerIterator } from "opensheetmusicdisplay";
import type { Slur } from "opensheetmusicdisplay/build/dist/src/MusicalScore/VoiceData/Expressions/ContinuousExpressions/Slur";

/* Turns a loaded OSMD sheet into a flat, time-ordered list of the notes a
   player is expected to produce. Times are kept in beats (the time
   signature's beat unit) so the tempo can be chosen at play time. */

export const DYNAMIC_MARKS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"] as const;
export type DynamicMark = (typeof DYNAMIC_MARKS)[number];

export type ScoreNote = {
  /* Position in the notes array. */
  index: number;
  /* Index of the cursor step (iterator position) this note starts on. */
  step: number;
  /* Printed measure number. */
  measure: number;
  startBeat: number;
  durationBeats: number;
  /* Empty for a rest. Several entries for a double stop. */
  midis: number[];
  name: string;
  isRest: boolean;
  dynamic: DynamicMark | null;
  /* First note under a slur: expects a fresh bow attack. */
  slurStart: boolean;
  /* Inside a slur after its first note: expects no new attack. */
  slurContinues: boolean;
  staccato: boolean;
};

export type CursorStep = { step: number; startBeat: number };

export type ScoreTimeline = {
  notes: ScoreNote[];
  /* The OSMD note objects behind each entry of notes, for drawing on the score. */
  sourceNotes: Note[][];
  steps: CursorStep[];
  beatsPerMeasure: number;
  /* 4 for a quarter-note beat, 8 for an eighth-note beat. */
  beatUnit: number;
  totalBeats: number;
  measureCount: number;
  /* Tempo written in the score, if any. */
  scoreBpm: number | null;
  title: string;
};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToName(midi: number) {
  const rounded = Math.round(midi);
  return `${noteNames[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

/* OSMD's halfTone is 12 below MIDI (its C4 is 48, MIDI's is 60). */
function noteToMidi(note: Note) {
  const pitch = note.TransposedPitch ?? note.Pitch;
  return pitch.getHalfTone() + 12;
}

/* OSMD's DynamicEnum is not re-exported from the package, so its numbering
   is mirrored here (pppppp = 0 ... ffffff = 13, then sf, sff, sfp, sfpp, fp,
   rf, rfz, sfz, sffz, fz, other, pf, sfzp, n). */
const dynamicByEnum: (DynamicMark | null)[] = [
  "ppp", "ppp", "ppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "fff", "fff", "fff",
  "f", "ff", "p", "pp", "p", "f", "f", "f", "ff", "f", null, "mf", "p", "ppp",
];

function dynamicFromText(text: string | undefined): DynamicMark | null {
  const letters = (text ?? "").trim().toLowerCase().match(/^[pmf]+/)?.[0];
  if (!letters) return null;
  if (letters.startsWith("mp")) return "mp";
  if (letters.startsWith("mf")) return "mf";
  if (letters.startsWith("ppp")) return "ppp";
  if (letters.startsWith("pp")) return "pp";
  if (letters.startsWith("p")) return "p";
  if (letters.startsWith("fff")) return "fff";
  if (letters.startsWith("ff")) return "ff";
  if (letters.startsWith("f")) return "f";
  return null;
}

function dynamicFromEnum(value: number | undefined, text: string | undefined): DynamicMark | null {
  if (typeof value === "number" && dynamicByEnum[value] !== undefined) return dynamicByEnum[value] ?? dynamicFromText(text);
  return dynamicFromText(text);
}

/* Every written dynamic marking with its absolute position in whole notes. */
function collectDynamics(osmd: OpenSheetMusicDisplay) {
  const marks: { wholeNotes: number; mark: DynamicMark }[] = [];
  for (const measure of osmd.Sheet.SourceMeasures) {
    for (const staffExpressions of measure.StaffLinkedExpressions ?? []) {
      for (const expression of staffExpressions ?? []) {
        const dynamic = expression.InstantaneousDynamic;
        if (!dynamic) continue;
        const mark = dynamicFromEnum(dynamic.DynEnum as unknown as number, dynamic.DynamicExpression);
        if (!mark) continue;
        marks.push({ wholeNotes: expression.AbsoluteTimestamp.RealValue, mark });
      }
    }
  }
  marks.sort((a, b) => a.wholeNotes - b.wholeNotes);
  return marks;
}

function scoreTempo(osmd: OpenSheetMusicDisplay): number | null {
  const sheet = osmd.Sheet;
  if (sheet.HasBPMInfo && sheet.DefaultStartTempoInBpm > 0) return Math.round(sheet.DefaultStartTempoInBpm);
  for (const measure of sheet.SourceMeasures) {
    for (const tempo of measure.TempoExpressions ?? []) {
      const bpm = tempo.InstantaneousTempo?.TempoInBpm;
      if (bpm && bpm > 0) return Math.round(bpm);
    }
  }
  return null;
}

/* Picks the voice entries of the lowest-numbered voice on the first visible
   instrument, which is the melody line for a single-staff cello part. */
function primaryEntries(entries: VoiceEntry[]) {
  const candidates = entries.filter((entry) => !entry.IsGrace && entry.Notes.length > 0);
  if (candidates.length === 0) return [];
  const instrument = candidates[0].ParentVoice.Parent;
  const sameInstrument = candidates.filter((entry) => entry.ParentVoice.Parent === instrument);
  const lowestVoice = Math.min(...sameInstrument.map((entry) => entry.ParentVoice.VoiceId));
  return sameInstrument.filter((entry) => entry.ParentVoice.VoiceId === lowestVoice);
}

export function buildTimeline(osmd: OpenSheetMusicDisplay): ScoreTimeline {
  const sheet = osmd.Sheet;
  const firstMeasure = sheet.SourceMeasures[0];
  const signature = firstMeasure?.ActiveTimeSignature;
  const beatsPerMeasure = signature?.Numerator ?? 4;
  const beatUnit = signature?.Denominator ?? 4;
  const toBeats = (wholeNotes: number) => wholeNotes * beatUnit;
  const dynamics = collectDynamics(osmd);

  /* A fresh iterator, independent of the cursor, walks every vertical position. */
  const iterator = new MusicPartManagerIterator(sheet);
  const notes: ScoreNote[] = [];
  const sourceNotes: Note[][] = [];
  const steps: CursorStep[] = [];
  const openSlurs = new Set<Slur>();
  let step = 0;
  let previous: ScoreNote | null = null;

  while (!iterator.EndReached) {
    const wholeNotes = iterator.currentTimeStamp.RealValue;
    const startBeat = toBeats(wholeNotes);
    steps.push({ step, startBeat });

    const entries = primaryEntries(iterator.CurrentVoiceEntries);
    const entry = entries[0];
    if (entry) {
      const entryNotes = entry.Notes.filter((note) => !note.IsCueNote);
      const pitched = entryNotes.filter((note) => !note.isRest());
      const durationBeats = toBeats(Math.max(...entryNotes.map((note) => note.Length.RealValue)));
      const tiedIn = pitched.length > 0 && pitched.every((note) => note.NoteTie && note.NoteTie.StartNote !== note);

      if (tiedIn && previous && !previous.isRest) {
        /* A tied continuation is the same sounding note. Extend the previous one. */
        previous.durationBeats = startBeat + durationBeats - previous.startBeat;
        for (const note of pitched) closeSlurs(note, openSlurs);
      } else {
        const slurStart = pitched.some((note) => note.NoteSlurs?.some((slur) => slur.StartNote === note));
        const slurContinues = openSlurs.size > 0 && !slurStart;
        for (const note of pitched) for (const slur of note.NoteSlurs ?? []) if (slur.StartNote === note) openSlurs.add(slur);
        for (const note of pitched) closeSlurs(note, openSlurs);

        const midis = [...new Set(pitched.map(noteToMidi))].sort((a, b) => a - b);
        const dynamic = lastDynamicAt(dynamics, wholeNotes);
        const scoreNote: ScoreNote = {
          index: notes.length,
          step,
          measure: iterator.CurrentMeasure.getPrintedMeasureNumber?.() ?? iterator.CurrentMeasure.MeasureNumber,
          startBeat,
          durationBeats,
          midis,
          name: midis.length === 0 ? "rest" : midis.map(midiToName).join("+"),
          isRest: midis.length === 0,
          dynamic,
          slurStart,
          slurContinues,
          staccato: entry.Articulations?.some(
            (articulation) =>
              articulation.articulationEnum === ArticulationEnum.staccato ||
              articulation.articulationEnum === ArticulationEnum.staccatissimo ||
              articulation.articulationEnum === ArticulationEnum.spiccato,
          ) ?? false,
        };
        notes.push(scoreNote);
        sourceNotes.push(entryNotes);
        previous = scoreNote;
      }
    }

    iterator.moveToNext();
    step += 1;
  }

  const last = notes[notes.length - 1];
  const totalBeats = last ? last.startBeat + last.durationBeats : 0;
  return {
    notes,
    sourceNotes,
    steps,
    beatsPerMeasure,
    beatUnit,
    totalBeats,
    measureCount: sheet.SourceMeasures.length,
    scoreBpm: scoreTempo(osmd),
    title: sheet.TitleString ?? "",
  };
}

function closeSlurs(note: Note, openSlurs: Set<Slur>) {
  for (const slur of note.NoteSlurs ?? []) if (slur.EndNote === note) openSlurs.delete(slur);
}

function lastDynamicAt(marks: { wholeNotes: number; mark: DynamicMark }[], wholeNotes: number) {
  let current: DynamicMark | null = null;
  for (const mark of marks) {
    if (mark.wholeNotes <= wholeNotes + 1e-6) current = mark.mark;
    else break;
  }
  return current;
}
