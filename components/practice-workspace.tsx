"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpenSheetMusicDisplay as OSMD } from "opensheetmusicdisplay";
import { buttonClass } from "@/components/button";
import NoteStrip from "@/components/note-strip";
import OpenSheetMusicDisplay from "@/components/open-sheet-music-display";
import PlaceholderPanel from "@/components/placeholder-panel";
import PracticeCamera from "@/components/practice-camera";
import ScoreOverlay from "@/components/score-overlay";
import TuningPanel from "@/components/tuning-panel";
import { SCORE_MXL, SCORE_NAME_KEY } from "@/components/upload-form";
import dataURLtoFile from "@/helpers";
import { RIGHT_WRIST, WristTrack, type PoseLandmark } from "@/lib/bowMotion";
import { METRICS_KEY } from "@/lib/metrics";
import {
  PracticeEngine,
  SETTINGS_KEY,
  dynamicFromDb,
  initialState,
  loadSettings,
  saveSettings,
  toPracticeMetrics,
  type EngineState,
  type PracticeSettings,
} from "@/lib/practiceEngine";
import { buildTimeline, type ScoreTimeline } from "@/lib/scoreTimeline";
import { setSessionFinisher } from "@/lib/sessionHandoff";

/* The practice screen below the header: the play bar, the note strip, and
   the camera and sheet music panels. Owns the engine and the score overlay. */
export default function PracticeWorkspace() {
  /* This component is only rendered in the browser (see workspace-client), so
     the stored score and settings can be read during the first render. */
  const [stored] = useState(readStoredScore);
  const file = stored.file;
  const scoreName = stored.name;
  const [loadError, setLoadError] = useState<string | null>(stored.error);
  const [timeline, setTimeline] = useState<ScoreTimeline | null>(null);
  const [settings, setSettings] = useState<PracticeSettings>(loadSettings);
  const [state, setState] = useState<EngineState>(() => initialState(null));
  const [showTuning, setShowTuning] = useState(false);
  const [osmd, setOsmd] = useState<OSMD | null>(null);
  const engineRef = useRef<PracticeEngine | null>(null);
  /* Right wrist positions from the camera, stamped with score time while the
     engine runs. Cleared at each Play and folded into the metrics at the end. */
  const [wrist] = useState(() => new WristTrack());
  /* The settings in force when a session ends, read when its metrics are written. */
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /* A session can be ended from outside the workspace: by the Review button
     in the header mid-piece, or by leaving the screen. stop() grades what
     was played and reports "finished", which stores the metrics (see play). */
  useEffect(() => {
    const finish = () => engineRef.current?.stop();
    setSessionFinisher(finish);
    return () => {
      setSessionFinisher(null);
      finish();
      engineRef.current?.dispose();
    };
  }, []);

  const handlePose = useCallback(
    (timestamp: number, landmarks: PoseLandmark[], aspect: number) => {
      wrist.push(landmarks[RIGHT_WRIST], aspect, engineRef.current?.scoreTimeAt(timestamp) ?? null);
    },
    [wrist],
  );

  const handleReady = useCallback((instance: OSMD) => {
    try {
      const built = buildTimeline(instance);
      setTimeline(built);
      setState(initialState(built));
      setOsmd(instance);
      if (built.scoreBpm && !hasStoredTempo())
        setSettings((current) => ({ ...current, bpm: built.scoreBpm! }));
      instance.cursor?.hide();
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Could not read the notes: ${error.message}`
          : "Could not read the notes.",
      );
    }
  }, []);

  const updateSettings = useCallback((next: PracticeSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.updateSettings(next);
  }, []);

  const getTime = useCallback(() => engineRef.current?.now() ?? null, []);

  function play() {
    if (!timeline) return;
    engineRef.current?.dispose();
    wrist.clear();
    const engine = new PracticeEngine(timeline, settings, (next) => {
      setState(next);
      /* Hand the session to the review page the moment it ends, whether it
         ran to the end or was stopped part way. A run with nothing graded
         (stopped during the count-in) leaves any earlier session in place. */
      if (next.phase === "finished" && next.summary && next.summary.gradedNotes > 0) {
        try {
          window.sessionStorage.setItem(
            METRICS_KEY,
            JSON.stringify(
              toPracticeMetrics(
                scoreName,
                timeline,
                next.grades,
                next.summary,
                settingsRef.current,
                wrist.all(),
              ),
            ),
          );
        } catch {
          /* Session storage may be unavailable. The feedback page then reports no session. */
        }
      }
    });
    engineRef.current = engine;
    setShowTuning(false);
    void engine.start();
  }

  function stop() {
    engineRef.current?.stop();
  }

  const running =
    state.phase === "countdown" ||
    state.phase === "playing" ||
    state.phase === "requesting-mic";
  const liveDynamic = useMemo(
    () =>
      state.live.db > settings.silenceDb
        ? dynamicFromDb(state.live.db, settings)
        : null,
    [state.live.db, settings],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className={buttonClass("secondary")}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={play}
            disabled={!timeline}
            className={buttonClass("primary")}
          >
            {state.phase === "finished" ? "Play again" : "Play"}
          </button>
        )}

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Tempo</span>
          <input
            type="number"
            min={20}
            max={240}
            value={settings.bpm}
            disabled={running}
            onChange={(event) =>
              updateSettings({
                ...settings,
                bpm: Math.max(
                  20,
                  Math.min(240, Number(event.target.value) || 20),
                ),
              })
            }
            className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-right tabular-nums disabled:opacity-50"
          />
          <span className="text-muted">bpm</span>
          {timeline ? (
            <span className="hidden text-xs text-muted sm:inline">
              {timeline.beatsPerMeasure}/{timeline.beatUnit}
              {timeline.scoreBpm ? ` · score says ${timeline.scoreBpm}` : ""}
            </span>
          ) : null}
        </label>

        <button
          type="button"
          onClick={() =>
            updateSettings({
              ...settings,
              clickDuringPlay: !settings.clickDuringPlay,
            })
          }
          aria-pressed={settings.clickDuringPlay}
          className={buttonClass(
            settings.clickDuringPlay ? "primary" : "secondary",
          )}
          title="Keep the click going after the count-in"
        >
          Metronome {settings.clickDuringPlay ? "on" : "off"}
        </button>

        <label
          className="flex items-center gap-2 text-sm"
          title="How early or late a note may start and still count"
        >
          <span className="text-muted">Timing ±</span>
          <input
            type="number"
            min={30}
            max={400}
            step={10}
            value={settings.timingToleranceMs}
            onChange={(event) =>
              updateSettings({
                ...settings,
                timingToleranceMs: Math.max(
                  30,
                  Math.min(400, Number(event.target.value) || 30),
                ),
              })
            }
            className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-right tabular-nums"
          />
          <span className="text-muted">ms</span>
        </label>

        <StatusLine
          state={state}
          timeline={timeline}
          loadError={loadError}
          liveDynamic={liveDynamic}
        />

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowTuning((open) => !open)}
            className={buttonClass("ghost")}
            aria-expanded={showTuning}
          >
            Tuning
          </button>
          {showTuning ? (
            <TuningPanel
              settings={settings}
              onChange={updateSettings}
              onClose={() => setShowTuning(false)}
              liveDb={state.live.db}
            />
          ) : null}
        </div>
      </div>

      {timeline ? (
        <div className="shrink-0 border-b border-border bg-background">
          <NoteStrip
            timeline={timeline}
            grades={state.grades}
            currentNoteIndex={state.currentNoteIndex}
          />
          {state.phase === "finished" && state.summary ? (
            <SummaryBar summary={state.summary} />
          ) : null}
        </div>
      ) : null}

      <div className="relative grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section
          aria-label="Camera"
          className="min-h-0 overflow-hidden bg-[#141311] lg:border-r lg:border-border"
        >
          <PracticeCamera onPose={handlePose} />
        </section>

        <section
          aria-label="Sheet music"
          className="relative min-h-0 overflow-auto border-t border-border bg-surface lg:border-t-0"
        >
          {loadError ? (
            <PlaceholderPanel
              title="Sheet music"
              note={loadError}
              status="Not loaded"
            />
          ) : (
            <div className="relative min-h-full">
              <OpenSheetMusicDisplay
                file={file}
                onReady={handleReady}
                onError={setLoadError}
              />
              <ScoreOverlay
                osmd={osmd}
                timeline={timeline}
                phase={state.phase}
                grades={state.grades}
                bpm={settings.bpm}
                getTime={getTime}
              />
            </div>
          )}
          {state.phase === "countdown" ? (
            <CountIn
              beats={state.countInBeats}
              beatsPerMeasure={timeline?.beatsPerMeasure ?? state.countInBeats}
              bpm={settings.bpm}
              getTime={getTime}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

/* The count-in display, driven by the audio clock at frame rate so each
   number lands on its click: 1 2 3 4 for a 4/4 measure, 1 to 6 for 6/8. */
function CountIn({
  beats,
  beatsPerMeasure,
  bpm,
  getTime,
}: {
  beats: number;
  beatsPerMeasure: number;
  bpm: number;
  getTime: () => number | null;
}) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const beatSeconds = 60 / bpm;
    let frame = 0;
    const step = () => {
      const seconds = getTime();
      if (seconds !== null) {
        /* seconds is negative during the count-in: -beats*beatSeconds at the first click, 0 at the downbeat. */
        const elapsed = beats * beatSeconds + seconds;
        setBeat(
          Math.max(
            0,
            Math.min(beats, Math.floor(elapsed / beatSeconds + 0.002) + 1),
          ),
        );
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [beats, bpm, getTime]);
  const inMeasure = beat === 0 ? 0 : ((beat - 1) % beatsPerMeasure) + 1;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/70">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted">Count in</p>
        <p
          key={beat}
          className={`font-mono text-8xl font-semibold tabular-nums ${inMeasure === 1 ? "text-foreground" : "text-muted"}`}
        >
          {beat === 0 ? "…" : inMeasure}
        </p>
        <p className="mt-2 flex justify-center gap-2" aria-hidden>
          {Array.from({ length: beatsPerMeasure }, (_, index) => (
            <span
              key={index}
              className={`h-2.5 w-2.5 rounded-full ${index < inMeasure ? "bg-foreground" : "bg-border-strong"}`}
            />
          ))}
        </p>
      </div>
    </div>
  );
}

function readStoredScore(): {
  file: File | null;
  name: string;
  error: string | null;
} {
  try {
    const dataURL = window.localStorage.getItem(SCORE_MXL);
    const name = window.localStorage.getItem(SCORE_NAME_KEY) ?? "score.mxl";
    if (!dataURL)
      return {
        file: null,
        name,
        error: "No score loaded. Go back and choose a MusicXML file.",
      };
    return { file: dataURLtoFile(dataURL, name), name, error: null };
  } catch {
    return {
      file: null,
      name: "Untitled score",
      error: "Could not read the stored score.",
    };
  }
}

function hasStoredTempo() {
  try {
    return window.localStorage.getItem(SETTINGS_KEY) !== null;
  } catch {
    return false;
  }
}

function StatusLine({
  state,
  timeline,
  loadError,
  liveDynamic,
}: {
  state: EngineState;
  timeline: ScoreTimeline | null;
  loadError: string | null;
  liveDynamic: string | null;
}) {
  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!timeline)
    return <p className="text-sm text-muted">Reading the score…</p>;
  switch (state.phase) {
    case "requesting-mic":
      return (
        <p className="text-sm text-muted">Waiting for microphone access…</p>
      );
    case "countdown":
      return <p className="text-sm text-muted">Counting in…</p>;
    case "playing": {
      const note =
        state.currentNoteIndex >= 0
          ? timeline.notes[state.currentNoteIndex]
          : null;
      return (
        <p className="flex items-center gap-3 font-mono text-sm tabular-nums">
          <span className="text-muted">
            m.{note?.measure ?? "–"} · want{" "}
            <span className="text-foreground">
              {note ? (note.isRest ? "rest" : note.name) : "–"}
            </span>
            {note?.dynamic ? ` ${note.dynamic}` : ""}
          </span>
          <span>
            heard{" "}
            <span className="text-foreground">{state.live.name ?? "–"}</span>
            {state.live.cents !== null ? (
              <span
                className={
                  Math.abs(state.live.cents) > 25 ? "text-danger" : "text-muted"
                }
              >
                {" "}
                {state.live.cents >= 0 ? "+" : ""}
                {state.live.cents.toFixed(0)}¢
              </span>
            ) : null}
            {liveDynamic ? (
              <span className="text-muted"> {liveDynamic}</span>
            ) : null}
          </span>
        </p>
      );
    }
    case "error":
      return <p className="text-sm text-danger">{state.error}</p>;
    case "finished":
      return (
        <p className="text-sm text-muted">
          Done. Hover a note for details, or review the session.
        </p>
      );
    default:
      return (
        <p className="text-sm text-muted">
          {timeline.notes.filter((note) => !note.isRest).length} notes over{" "}
          {timeline.measureCount} measures
        </p>
      );
  }
}

function percent(value: number | null) {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

function SummaryBar({
  summary,
}: {
  summary: NonNullable<EngineState["summary"]>;
}) {
  const items = [
    {
      label: "Pitch",
      value: percent(summary.pitchAccuracy),
      detail:
        summary.meanAbsCents !== null
          ? `avg ${summary.meanAbsCents.toFixed(0)}¢ off`
          : "",
    },
    {
      label: "Rhythm",
      value: percent(summary.rhythmAccuracy),
      detail:
        summary.meanAbsTimingMs !== null
          ? `avg ${summary.meanAbsTimingMs.toFixed(0)} ms off`
          : "",
    },
    {
      label: "Dynamics",
      value: percent(summary.dynamicAccuracy),
      detail: summary.dynamicAccuracy === null ? "no markings" : "",
    },
    {
      label: "Musical Slurs",
      value: percent(summary.slurAccuracy),
      detail: summary.slurAccuracy === null ? "no slurs" : "",
    },
    {
      label: "Tempo",
      value: summary.averagePlayedBpm ? `${summary.averagePlayedBpm} bpm` : "–",
      detail: `${summary.gradedNotes} notes graded`,
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border px-4 py-2">
      {items.map((item) => (
        <p key={item.label} className="text-sm">
          <span className="text-muted">{item.label} </span>
          <span className="font-mono font-semibold tabular-nums">
            {item.value}
          </span>
          {item.detail ? (
            <span className="text-xs text-muted"> {item.detail}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
