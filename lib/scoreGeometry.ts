import type { GraphicalNote, MusicSystem, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { NoteStatus } from "@/lib/practiceEngine";
import type { ScoreTimeline } from "@/lib/scoreTimeline";

/* Pixel geometry of the rendered score, used to draw a playback bar over it
   and to color note heads. Mirrors how OSMD's own cursor places itself:
   OSMD units times 10 times the zoom factor, relative to the render div. */

export type NoteAnchor = {
  index: number;
  startBeat: number;
  /* Left edge of the note, in px. */
  x: number;
  /* Right edge of the measure the note sits in, in px. */
  measureEndX: number;
  top: number;
  height: number;
  system: MusicSystem | null;
  svg: SVGGElement[];
};

type VexNote = GraphicalNote & { getSVGGElement?: () => SVGGElement | undefined };

function systemBounds(system: MusicSystem, scale: number) {
  const first = system.StaffLines[0];
  const last = system.StaffLines[system.StaffLines.length - 1];
  const top = system.PositionAndShape.AbsolutePosition.y + (first?.PositionAndShape.RelativePosition.y ?? 0);
  const bottom = system.PositionAndShape.AbsolutePosition.y + (last ? last.PositionAndShape.RelativePosition.y + last.StaffHeight : 4);
  return { top: top * scale, height: Math.max(4, bottom - top) * scale };
}

export function computeAnchors(osmd: OpenSheetMusicDisplay, timeline: ScoreTimeline): NoteAnchor[] {
  const scale = 10 * osmd.Zoom;
  const anchors: NoteAnchor[] = [];
  timeline.notes.forEach((note, index) => {
    const graphical = (timeline.sourceNotes[index] ?? [])
      .map((source) => {
        try {
          return osmd.EngravingRules.GNote(source) as VexNote | undefined;
        } catch {
          return undefined;
        }
      })
      .filter((candidate): candidate is VexNote => Boolean(candidate));
    const staffEntry = graphical[0]?.parentVoiceEntry?.parentStaffEntry;
    if (!staffEntry) {
      /* No graphical note (hidden or unusual entry): fall back to the start
         of its measure so the bar still lands on the right line. */
      const measure = osmd.GraphicSheet.MeasureList.find((row) => row[0]?.MeasureNumber === note.measure)?.[0];
      const previous = anchors[anchors.length - 1];
      const bounds = measure ? systemBounds(measure.ParentMusicSystem, scale) : null;
      anchors.push({
        index,
        startBeat: note.startBeat,
        x: measure ? measure.PositionAndShape.AbsolutePosition.x * scale : previous?.x ?? 0,
        measureEndX: measure ? (measure.PositionAndShape.AbsolutePosition.x + measure.PositionAndShape.Size.width) * scale : previous?.measureEndX ?? 0,
        top: bounds?.top ?? previous?.top ?? 0,
        height: bounds?.height ?? previous?.height ?? 40,
        system: measure?.ParentMusicSystem ?? previous?.system ?? null,
        svg: [],
      });
      return;
    }
    const measure = staffEntry.parentMeasure;
    const system = measure.ParentMusicSystem;
    const bounds = systemBounds(system, scale);
    anchors.push({
      index,
      startBeat: note.startBeat,
      x: staffEntry.PositionAndShape.AbsolutePosition.x * scale,
      measureEndX: (measure.PositionAndShape.AbsolutePosition.x + measure.PositionAndShape.Size.width) * scale,
      top: bounds.top,
      height: bounds.height,
      system,
      svg: graphical.map((candidate) => candidate.getSVGGElement?.()).filter((element): element is SVGGElement => Boolean(element)),
    });
  });
  return anchors;
}

export type BarPosition = { x: number; top: number; height: number; noteIndex: number };

/* Where the bar should be at a given beat: sliding from each note toward the
   next one on the same line, or toward the end of its measure at a line break. */
export function barPositionAt(anchors: NoteAnchor[], beat: number, totalBeats: number): BarPosition | null {
  if (anchors.length === 0) return null;
  if (beat <= anchors[0].startBeat) return { x: anchors[0].x, top: anchors[0].top, height: anchors[0].height, noteIndex: 0 };
  let low = 0;
  let high = anchors.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (anchors[middle].startBeat <= beat) low = middle;
    else high = middle - 1;
  }
  const current = anchors[low];
  const next = anchors[low + 1];
  const endBeat = next ? next.startBeat : totalBeats;
  const span = endBeat - current.startBeat;
  const progress = span > 0 ? Math.min(1, Math.max(0, (beat - current.startBeat) / span)) : 1;
  const targetX = next && next.system === current.system && next.x > current.x ? next.x : current.measureEndX;
  return { x: current.x + (targetX - current.x) * progress, top: current.top, height: current.height, noteIndex: low };
}

const statusColor: Partial<Record<NoteStatus, string>> = {
  good: "#1f8a4c",
  partial: "#c77d00",
  bad: "#c0392b",
};

/* Paints the note's SVG group with the color of its grade. Inline styles win
   over VexFlow's fill attributes and can be cleared for the next attempt. */
export function paintNote(anchor: NoteAnchor, status: NoteStatus) {
  const color = statusColor[status];
  for (const group of anchor.svg) {
    for (const shape of group.querySelectorAll<SVGElement>("path, ellipse, rect, text")) {
      if (color) {
        shape.style.fill = color;
        shape.style.stroke = color;
      } else {
        shape.style.removeProperty("fill");
        shape.style.removeProperty("stroke");
      }
    }
  }
}
