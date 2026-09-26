"use client";

import { useEffect, useRef } from "react";
import type { OpenSheetMusicDisplay as OSMD } from "opensheetmusicdisplay";
import type { NoteGrade, NoteStatus, Phase } from "@/lib/practiceEngine";
import { barPositionAt, computeAnchors, paintNote, type NoteAnchor } from "@/lib/scoreGeometry";
import type { ScoreTimeline } from "@/lib/scoreTimeline";

type Props = {
  osmd: OSMD | null;
  timeline: ScoreTimeline | null;
  phase: Phase;
  grades: NoteGrade[];
  bpm: number;
  /* Score time in seconds on the audio clock, negative during the count-in. */
  getTime: () => number | null;
};

/* Draws a bar that slides along the rendered score in time with the engine,
   and colors each note on the score once it has been graded. Must sit in a
   positioned wrapper that also contains the OSMD render div. */
export default function ScoreOverlay({ osmd, timeline, phase, grades, bpm, getTime }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<NoteAnchor[]>([]);
  const paintedRef = useRef<NoteStatus[]>([]);
  const lastTopRef = useRef<number | null>(null);

  /* Anchors depend on the rendered layout, so they are rebuilt when OSMD
     re-renders after a resize (its SVG is replaced, and colors with it). */
  useEffect(() => {
    if (!osmd || !timeline) return;
    const rebuild = () => {
      anchorsRef.current = computeAnchors(osmd, timeline);
      paintedRef.current = [];
      repaint(anchorsRef.current, paintedRef, grades);
    };
    rebuild();
    const container = barRef.current?.parentElement;
    if (!container) return;
    let timer: number | null = null;
    const observer = new ResizeObserver(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(rebuild, 400);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
    // grades are applied through the effect below; rebuild only needs the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osmd, timeline]);

  useEffect(() => {
    if (anchorsRef.current.length === 0) return;
    if (anchorsRef.current.some((anchor) => anchor.svg.some((element) => !element.isConnected)) && osmd && timeline) {
      anchorsRef.current = computeAnchors(osmd, timeline);
      paintedRef.current = [];
    }
    repaint(anchorsRef.current, paintedRef, grades);
  }, [grades, osmd, timeline]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !timeline) return;
    const active = phase === "countdown" || phase === "playing";
    if (!active) {
      bar.style.opacity = "0";
      lastTopRef.current = null;
      return;
    }
    const beatSeconds = 60 / bpm;
    let frame = 0;
    const step = () => {
      const anchors = anchorsRef.current;
      const seconds = getTime();
      if (anchors.length > 0 && seconds !== null) {
        const beat = Math.max(0, seconds / beatSeconds);
        const position = barPositionAt(anchors, beat, timeline.totalBeats);
        if (position) {
          bar.style.opacity = "1";
          bar.style.transform = `translate(${position.x - 6}px, ${position.top - 8}px)`;
          bar.style.height = `${position.height + 16}px`;
          if (lastTopRef.current !== position.top) {
            lastTopRef.current = position.top;
            bar.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, timeline, bpm, getTime]);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 w-1 rounded-full bg-[#c9a227] opacity-0 shadow-[0_0_0_4px_rgba(201,162,39,0.28)] transition-opacity"
    />
  );
}

function repaint(anchors: NoteAnchor[], paintedRef: { current: NoteStatus[] }, grades: NoteGrade[]) {
  for (const anchor of anchors) {
    const status = grades[anchor.index]?.status ?? "pending";
    if (paintedRef.current[anchor.index] === status) continue;
    paintedRef.current[anchor.index] = status;
    paintNote(anchor, status);
  }
}
