import { detectPitchNsdf, rmsOf, toDecibels } from "@/lib/audioPitch";
import type { MeasureMetrics, PracticeMetrics } from "@/lib/metrics";
import { DYNAMIC_MARKS, midiToName, type DynamicMark, type ScoreNote, type ScoreTimeline } from "@/lib/scoreTimeline";

/* Runs one play-through: counts in a measure of clicks, then listens to the
   microphone and grades each note of the timeline against what was played.
   Everything time-related uses the AudioContext clock so clicks and frames
   line up. All thresholds live in PracticeSettings so they can be tuned. */

export type PracticeSettings = {
  bpm: number;
  /* How far an onset may land from the written beat and still count. */
  timingToleranceMs: number;
  /* How far the played pitch may sit from the written pitch. */
  pitchToleranceCents: number;
  /* How many dynamic levels off (p vs mp = 1) still count as right. */
  dynamicToleranceSteps: number;
  /* Loudness distance between neighbouring dynamic levels. */
  dynamicStepDb: number;
  /* Measured level (dBFS) that counts as mf on this microphone. */
  mfReferenceDb: number;
  /* Rise in level after a dip that counts as a new bow attack. */
  attackThresholdDb: number;
  /* Below this level the frame counts as silence. */
  silenceDb: number;
  /* Delay between the sound and the microphone frame, subtracted from timings. */
  latencyMs: number;
  /* Number of count-in measures before the mic starts grading. */
  countInMeasures: number;
  /* Keep the click going while playing. */
  clickDuringPlay: boolean;
};

export const defaultSettings: PracticeSettings = {
  bpm: 72,
  timingToleranceMs: 120,
  pitchToleranceCents: 35,
  dynamicToleranceSteps: 1,
  dynamicStepDb: 6,
  mfReferenceDb: -26,
  attackThresholdDb: 6,
  silenceDb: -50,
  latencyMs: 40,
  countInMeasures: 1,
  clickDuringPlay: false,
};

export const SETTINGS_KEY = "cello-buddy:practice-settings";

export function loadSettings(): PracticeSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<PracticeSettings>) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: PracticeSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Storage may be unavailable. Settings then last for the page only. */
  }
}

export type NoteStatus = "pending" | "current" | "good" | "partial" | "bad" | "skipped";

export type NoteGrade = {
  index: number;
  status: NoteStatus;
  pitch: { playedMidi: number | null; playedName: string | null; cents: number | null; ok: boolean | null };
  timing: { deviationMs: number | null; ok: boolean | null };
  dynamic: { expected: DynamicMark | null; played: DynamicMark | null; peakDb: number | null; ok: boolean | null };
  slur: { expected: "slurred" | "attack" | null; playedAttack: boolean | null; ok: boolean | null };
};

export type SessionSummary = {
  gradedNotes: number;
  pitchAccuracy: number | null;
  rhythmAccuracy: number | null;
  dynamicAccuracy: number | null;
  slurAccuracy: number | null;
  meanAbsCents: number | null;
  meanAbsTimingMs: number | null;
  averagePlayedBpm: number | null;
  durationSeconds: number;
};

export type Phase = "idle" | "requesting-mic" | "countdown" | "playing" | "finished" | "error";

export type EngineState = {
  phase: Phase;
  /* Beats left in the count-in, counting down to 1. */
  countdownBeat: number;
  elapsedSeconds: number;
  currentNoteIndex: number;
  currentStep: number;
  live: { midi: number | null; name: string | null; cents: number | null; db: number };
  grades: NoteGrade[];
  summary: SessionSummary | null;
  error: string | null;
};

type Frame = { t: number; db: number; midi: number | null };
type Onset = { t: number; attack: boolean };

function emptyGrade(index: number, note: ScoreNote): NoteGrade {
  return {
    index,
    status: "pending",
    pitch: { playedMidi: null, playedName: null, cents: null, ok: null },
    timing: { deviationMs: null, ok: null },
    dynamic: { expected: note.dynamic, played: null, peakDb: null, ok: null },
    slur: { expected: note.slurContinues ? "slurred" : note.slurStart ? "attack" : null, playedAttack: null, ok: null },
  };
}

export function initialState(timeline: ScoreTimeline | null): EngineState {
  return {
    phase: "idle",
    countdownBeat: 0,
    elapsedSeconds: 0,
    currentNoteIndex: -1,
    currentStep: -1,
    live: { midi: null, name: null, cents: null, db: -120 },
    grades: timeline ? timeline.notes.map((note, index) => emptyGrade(index, note)) : [],
    summary: null,
    error: null,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function dynamicFromDb(db: number, settings: PracticeSettings): DynamicMark {
  const mfIndex = DYNAMIC_MARKS.indexOf("mf");
  const steps = Math.round((db - settings.mfReferenceDb) / settings.dynamicStepDb);
  const index = Math.max(0, Math.min(DYNAMIC_MARKS.length - 1, mfIndex + steps));
  return DYNAMIC_MARKS[index];
}

export class PracticeEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private timer: number | null = null;
  private state: EngineState;
  private frames: Frame[] = [];
  private onsets: Onset[] = [];
  private startTime = 0;
  private nextClickBeat = 0;
  private stableMidi: number | null = null;
  private candidateMidi: number | null = null;
  private candidateSince = 0;
  private lastAttackAt = -1;
  private wasSilent = true;
  private gradedUpTo = 0;
  private notePointer = 0;
  private stepPointer = 0;
  private finished = false;

  constructor(
    private readonly timeline: ScoreTimeline,
    private settings: PracticeSettings,
    private readonly onChange: (state: EngineState) => void,
  ) {
    this.state = initialState(timeline);
  }

  get beatSeconds() {
    return 60 / this.settings.bpm;
  }

  updateSettings(settings: PracticeSettings) {
    this.settings = settings;
  }

  /* Seconds of score time elapsed since the count-in ended, on the audio
     clock. Negative during the count-in, null when not running. */
  now(): number | null {
    if (!this.context || this.finished) return null;
    return this.context.currentTime - this.startTime;
  }

  async start() {
    if (this.state.phase !== "idle" && this.state.phase !== "finished" && this.state.phase !== "error") return;
    this.reset();
    this.emit({ phase: "requesting-mic" });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (error) {
      this.emit({ phase: "error", error: error instanceof Error ? `Microphone unavailable: ${error.message}` : "Microphone unavailable." });
      return;
    }
    const context = new AudioContext();
    await context.resume();
    this.context = context;
    const source = context.createMediaStreamSource(this.stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    this.analyser = analyser;
    this.buffer = new Float32Array(analyser.fftSize);

    const countInBeats = this.settings.countInMeasures * this.timeline.beatsPerMeasure;
    const countStart = context.currentTime + 0.15;
    this.startTime = countStart + countInBeats * this.beatSeconds;
    for (let beat = 0; beat < countInBeats; beat += 1) {
      this.click(countStart + beat * this.beatSeconds, beat % this.timeline.beatsPerMeasure === 0);
    }
    this.nextClickBeat = 0;
    this.emit({ phase: "countdown", countdownBeat: countInBeats });
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.state.phase === "playing" || this.state.phase === "countdown" || this.state.phase === "requesting-mic") {
      this.finish(true);
    }
  }

  dispose() {
    this.teardownAudio();
  }

  private reset() {
    this.teardownAudio();
    this.frames = [];
    this.onsets = [];
    this.stableMidi = null;
    this.candidateMidi = null;
    this.candidateSince = 0;
    this.lastAttackAt = -1;
    this.wasSilent = true;
    this.gradedUpTo = 0;
    this.notePointer = 0;
    this.stepPointer = 0;
    this.finished = false;
    this.state = initialState(this.timeline);
  }

  private teardownAudio() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private emit(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  private click(time: number, accent: boolean) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.15, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.06);
  }

  private tick() {
    if (!this.context || !this.analyser || !this.buffer) return;
    const now = this.context.currentTime;
    const t = now - this.startTime - this.settings.latencyMs / 1000;

    if (now < this.startTime) {
      const beatsLeft = Math.ceil((this.startTime - now) / this.beatSeconds);
      if (beatsLeft !== this.state.countdownBeat) this.emit({ countdownBeat: beatsLeft });
      return;
    }

    if (this.settings.clickDuringPlay) {
      while (this.startTime + this.nextClickBeat * this.beatSeconds < now + 0.25) {
        if (this.nextClickBeat < this.timeline.totalBeats) {
          this.click(this.startTime + this.nextClickBeat * this.beatSeconds, this.nextClickBeat % this.timeline.beatsPerMeasure === 0);
        }
        this.nextClickBeat += 1;
      }
    }

    this.analyser.getFloatTimeDomainData(this.buffer);
    const db = toDecibels(rmsOf(this.buffer));
    const silent = db < this.settings.silenceDb;
    const estimate = silent ? null : detectPitchNsdf(this.buffer, this.context.sampleRate, { minFrequency: 55, maxFrequency: 1500 });
    const frame: Frame = { t, db, midi: estimate?.midi ?? null };
    this.frames.push(frame);
    this.detectOnsets(frame, silent);

    const beat = t / this.beatSeconds;
    const notes = this.timeline.notes;
    while (this.notePointer < notes.length && notes[this.notePointer].startBeat + notes[this.notePointer].durationBeats <= beat) this.notePointer += 1;
    const currentNoteIndex = this.notePointer < notes.length && notes[this.notePointer].startBeat <= beat ? this.notePointer : -1;
    const steps = this.timeline.steps;
    while (this.stepPointer + 1 < steps.length && steps[this.stepPointer + 1].startBeat <= beat) this.stepPointer += 1;

    const gradesChanged = this.gradeReadyNotes(t);
    const markCurrent = currentNoteIndex >= 0 && this.state.grades[currentNoteIndex].status === "pending";
    const grades = gradesChanged || markCurrent ? [...this.state.grades] : this.state.grades;
    if (markCurrent) grades[currentNoteIndex] = { ...grades[currentNoteIndex], status: "current" };

    const live = estimate
      ? { midi: estimate.midi, name: midiToName(estimate.midi), cents: (estimate.midi - Math.round(estimate.midi)) * 100, db }
      : { midi: null, name: null, cents: null, db };

    this.emit({
      phase: "playing",
      elapsedSeconds: Math.max(0, t),
      currentNoteIndex,
      currentStep: steps[this.stepPointer]?.step ?? -1,
      live,
      grades,
    });

    const endSeconds = this.timeline.totalBeats * this.beatSeconds + this.settings.timingToleranceMs / 1000 + 0.4;
    if (t >= endSeconds) this.finish(false);
  }

  /* Two kinds of onset: a bow attack (level rises sharply after a dip or
     after silence) and a plain pitch change (the left hand moves under a
     slur). Both mark a new note; only the first counts as a fresh bow. */
  private detectOnsets(frame: Frame, silent: boolean) {
    const { t, db, midi } = frame;
    const windowStart = t - 0.15;
    let dip = Infinity;
    for (let index = this.frames.length - 2; index >= 0; index -= 1) {
      const past = this.frames[index];
      if (past.t < windowStart) break;
      if (past.t <= t - 0.02) dip = Math.min(dip, past.db);
    }
    const fromSilence = this.wasSilent && !silent;
    const rose = dip !== Infinity && db - dip >= this.settings.attackThresholdDb;
    if (!silent && (fromSilence || rose) && t - this.lastAttackAt >= 0.08) {
      this.onsets.push({ t, attack: true });
      this.lastAttackAt = t;
      this.candidateMidi = midi !== null ? Math.round(midi) : null;
      this.stableMidi = this.candidateMidi;
      this.candidateSince = t;
    } else if (midi !== null) {
      const rounded = Math.round(midi);
      if (rounded === this.stableMidi) {
        this.candidateMidi = null;
      } else if (this.candidateMidi === rounded) {
        if (t - this.candidateSince >= 0.03) {
          this.onsets.push({ t: this.candidateSince, attack: false });
          this.stableMidi = rounded;
          this.candidateMidi = null;
        }
      } else {
        this.candidateMidi = rounded;
        this.candidateSince = t;
      }
    }
    if (silent) this.stableMidi = null;
    this.wasSilent = silent;
  }

  /* Grades every note whose window (plus tolerance) has passed. */
  private gradeReadyNotes(t: number, force = false) {
    const tolerance = this.settings.timingToleranceMs / 1000;
    const grades = this.state.grades;
    let changed = false;
    while (this.gradedUpTo < this.timeline.notes.length) {
      const note = this.timeline.notes[this.gradedUpTo];
      const start = note.startBeat * this.beatSeconds;
      const end = start + note.durationBeats * this.beatSeconds;
      if (!force && t < end + tolerance) break;
      if (force && t < start + 0.05) break;
      grades[this.gradedUpTo] = this.gradeNote(note, grades[this.gradedUpTo], start, Math.min(end, force ? t : end));
      this.gradedUpTo += 1;
      changed = true;
    }
    return changed;
  }

  private gradeNote(note: ScoreNote, grade: NoteGrade, start: number, end: number): NoteGrade {
    const settings = this.settings;
    const tolerance = settings.timingToleranceMs / 1000;
    const duration = end - start;
    const margin = Math.min(tolerance, duration / 4);
    let core = this.frames.filter((frame) => frame.t >= start + margin && frame.t <= end - margin);
    if (core.length < 3) core = this.frames.filter((frame) => frame.t >= start && frame.t <= end);
    const pitched = core.filter((frame) => frame.midi !== null) as (Frame & { midi: number })[];
    const result: NoteGrade = { ...grade, pitch: { ...grade.pitch }, timing: { ...grade.timing }, dynamic: { ...grade.dynamic }, slur: { ...grade.slur } };

    if (note.isRest) {
      const noisy = core.length > 0 && pitched.length / core.length > 0.5;
      result.pitch.ok = !noisy;
      result.status = noisy ? "partial" : "good";
      return result;
    }

    /* Pitch: the median of the sustained part of the note. */
    if (pitched.length >= 2 && pitched.length >= core.length * 0.2) {
      const playedMidi = median(pitched.map((frame) => frame.midi));
      const expected = note.midis.reduce((best, midi) => (Math.abs(midi - playedMidi) < Math.abs(best - playedMidi) ? midi : best), note.midis[0]);
      const cents = (playedMidi - expected) * 100;
      result.pitch = { playedMidi, playedName: midiToName(playedMidi), cents, ok: Math.abs(cents) <= settings.pitchToleranceCents };
    } else {
      result.pitch = { playedMidi: null, playedName: null, cents: null, ok: false };
    }

    /* Timing: the onset closest to the written start, without reaching back
       into the previous note. */
    const previous = this.timeline.notes[note.index - 1];
    const previousStart = previous ? previous.startBeat * this.beatSeconds : -Infinity;
    const lower = Math.max(start - 1.5 * tolerance, previousStart + 0.05);
    const upper = start + 1.5 * tolerance;
    const candidates = this.onsets.filter((onset) => onset.t >= lower && onset.t <= upper);
    const onset = candidates.reduce<Onset | null>((best, candidate) => (!best || Math.abs(candidate.t - start) < Math.abs(best.t - start) ? candidate : best), null);
    if (onset) {
      const deviationMs = (onset.t - start) * 1000;
      result.timing = { deviationMs, ok: Math.abs(deviationMs) <= settings.timingToleranceMs };
    } else {
      result.timing = { deviationMs: null, ok: false };
    }

    /* Dynamic: the loud part of the note, mapped onto the ppp..fff ladder. */
    const audible = core.filter((frame) => frame.db > settings.silenceDb).map((frame) => frame.db);
    if (audible.length > 0) {
      const peakDb = percentile(audible, 0.9);
      const played = dynamicFromDb(peakDb, settings);
      const ok = note.dynamic ? Math.abs(DYNAMIC_MARKS.indexOf(played) - DYNAMIC_MARKS.indexOf(note.dynamic)) <= settings.dynamicToleranceSteps : null;
      result.dynamic = { expected: note.dynamic, played, peakDb, ok };
    } else {
      result.dynamic = { expected: note.dynamic, played: null, peakDb: null, ok: note.dynamic ? false : null };
    }

    /* Slur: a note inside a slur should change pitch without a new attack;
       the first note of a slur should get one. */
    const attackNearby = candidates.some((candidate) => candidate.attack);
    const playedAttack = candidates.length > 0 ? attackNearby : null;
    const expectedSlur = result.slur.expected;
    result.slur = {
      expected: expectedSlur,
      playedAttack,
      ok: expectedSlur === null || playedAttack === null ? null : expectedSlur === "slurred" ? !playedAttack : playedAttack,
    };

    if (result.pitch.ok === false) result.status = "bad";
    else if (result.timing.ok === false || result.dynamic.ok === false || result.slur.ok === false) result.status = "partial";
    else result.status = "good";
    return result;
  }

  private finish(stoppedEarly: boolean) {
    if (this.finished) return;
    this.finished = true;
    const t = this.context ? this.context.currentTime - this.startTime - this.settings.latencyMs / 1000 : 0;
    const grades = [...this.state.grades];
    this.state = { ...this.state, grades };
    if (this.state.phase === "playing" || (stoppedEarly && t > 0)) this.gradeReadyNotes(t, true);
    for (let index = 0; index < grades.length; index += 1) {
      if (grades[index].status === "pending" || grades[index].status === "current") grades[index] = { ...grades[index], status: "skipped" };
    }
    const summary = summarize(this.timeline, grades, this.settings, Math.max(0, t));
    this.teardownAudio();
    this.emit({ phase: "finished", grades, summary, currentNoteIndex: -1, live: { midi: null, name: null, cents: null, db: -120 } });
  }
}

function ratio(values: (boolean | null)[]) {
  const graded = values.filter((value): value is boolean => value !== null);
  return graded.length ? graded.filter(Boolean).length / graded.length : null;
}

function meanAbs(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? present.reduce((sum, value) => sum + Math.abs(value), 0) / present.length : null;
}

export function summarize(timeline: ScoreTimeline, grades: NoteGrade[], settings: PracticeSettings, durationSeconds: number): SessionSummary {
  const graded = grades.filter((grade, index) => !timeline.notes[index].isRest && grade.status !== "pending" && grade.status !== "skipped" && grade.status !== "current");
  const played = graded.filter((grade) => grade.timing.deviationMs !== null);
  let averagePlayedBpm: number | null = null;
  if (played.length >= 4) {
    /* Slope of played time against written time gives the effective tempo. */
    const beatSeconds = 60 / settings.bpm;
    const points = played.map((grade) => {
      const expected = timeline.notes[grade.index].startBeat * beatSeconds;
      return [expected, expected + (grade.timing.deviationMs ?? 0) / 1000];
    });
    const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
    const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
    const slope = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / (points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0) || 1);
    if (slope > 0.5 && slope < 2) averagePlayedBpm = Math.round(settings.bpm / slope);
  }
  return {
    gradedNotes: graded.length,
    pitchAccuracy: ratio(graded.map((grade) => grade.pitch.ok)),
    rhythmAccuracy: ratio(graded.map((grade) => grade.timing.ok)),
    dynamicAccuracy: ratio(graded.map((grade) => grade.dynamic.ok)),
    slurAccuracy: ratio(graded.map((grade) => grade.slur.ok)),
    meanAbsCents: meanAbs(graded.map((grade) => grade.pitch.cents)),
    meanAbsTimingMs: meanAbs(graded.map((grade) => grade.timing.deviationMs)),
    averagePlayedBpm,
    durationSeconds,
  };
}

/* Folds the per-note grades into the per-measure shape the feedback chat expects. */
export function toPracticeMetrics(piece: string, timeline: ScoreTimeline, grades: NoteGrade[], summary: SessionSummary, settings: PracticeSettings): PracticeMetrics {
  const byMeasure = new Map<number, NoteGrade[]>();
  grades.forEach((grade, index) => {
    const note = timeline.notes[index];
    if (note.isRest || grade.status === "pending" || grade.status === "skipped" || grade.status === "current") return;
    byMeasure.set(note.measure, [...(byMeasure.get(note.measure) ?? []), grade]);
  });
  const measures: MeasureMetrics[] = [...byMeasure.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, measureGrades]) => {
      const cents = measureGrades.map((grade) => grade.pitch.cents).filter((value): value is number => value !== null);
      const timings = measureGrades.map((grade) => grade.timing.deviationMs).filter((value): value is number => value !== null);
      return {
        number,
        notes: measureGrades.length,
        intonationMeanCents: cents.length ? Math.round(cents.reduce((sum, value) => sum + value, 0) / cents.length) : 0,
        intonationMaxAbsCents: cents.length ? Math.round(Math.max(...cents.map(Math.abs))) : 0,
        timingDeviationMs: timings.length ? Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length) : 0,
        bowAngleVarianceDeg: 0,
        contactPointDriftMm: 0,
        postureFlags: [],
      };
    });
  return {
    piece,
    recordedAt: new Date().toISOString(),
    durationSeconds: Math.round(summary.durationSeconds),
    tempo: { target: settings.bpm, averagePlayed: summary.averagePlayedBpm ?? settings.bpm },
    summary: {
      intonationMeanAbsCents: Math.round(summary.meanAbsCents ?? 0),
      timingMeanAbsMs: Math.round(summary.meanAbsTimingMs ?? 0),
      bowAngleVarianceDeg: 0,
      contactPointDriftMm: 0,
      postureFlags: [],
    },
    measures,
  };
}
