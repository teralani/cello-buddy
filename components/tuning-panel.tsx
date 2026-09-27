"use client";

import { buttonClass } from "@/components/button";
import { defaultSettings, type PracticeSettings } from "@/lib/practiceEngine";

type Props = {
  settings: PracticeSettings;
  onChange: (settings: PracticeSettings) => void;
  onClose: () => void;
  /* Current microphone level so the mf reference can be set by ear. */
  liveDb: number;
};

type NumericKey = {
  [K in keyof PracticeSettings]: PracticeSettings[K] extends number ? K : never;
}[keyof PracticeSettings];

const sliders: { key: NumericKey; label: string; hint: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "timingToleranceMs", label: "Rhythm wiggle room", hint: "How early or late a note may start and still count.", min: 30, max: 400, step: 10, unit: "ms" },
  { key: "pitchToleranceCents", label: "Pitch tolerance", hint: "Distance from the written pitch that still counts as in tune.", min: 5, max: 100, step: 5, unit: "¢" },
  { key: "pitchClarity", label: "Pitch clarity floor", hint: "How periodic a frame must be to count as a pitch. Lower for bowed strings, higher for a clean voice.", min: 0.3, max: 0.95, step: 0.05, unit: "" },
  { key: "dynamicToleranceSteps", label: "Dynamic tolerance", hint: "Levels off the marking that still count (p vs mp is one level).", min: 0, max: 3, step: 1, unit: "levels" },
  { key: "dynamicStepDb", label: "Loudness per level", hint: "Decibels between neighbouring dynamics.", min: 3, max: 10, step: 1, unit: "dB" },
  { key: "mfReferenceDb", label: "mf reference level", hint: "Play a comfortable mf and set this near the live level shown below.", min: -60, max: -6, step: 1, unit: "dB" },
  { key: "attackThresholdDb", label: "Bow attack sensitivity", hint: "Level jump that counts as a new bow. Lower catches gentler bow changes.", min: 2, max: 15, step: 1, unit: "dB" },
  { key: "silenceDb", label: "Silence floor", hint: "Below this level the mic is treated as silent.", min: -80, max: -30, step: 1, unit: "dB" },
  { key: "latencyMs", label: "Mic latency", hint: "Delay between the string and the mic frame. Raise if every note reads late.", min: 0, max: 200, step: 5, unit: "ms" },
];

export default function TuningPanel({ settings, onChange, onClose, liveDb }: Props) {
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Tuning</p>
        <button type="button" onClick={() => onChange({ ...defaultSettings, bpm: settings.bpm })} className={buttonClass("ghost", "h-7 px-2 text-xs")}>
          Reset
        </button>
      </div>
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        {sliders.map((slider) => (
          <label key={slider.key} className="block">
            <span className="flex items-center justify-between text-xs font-medium">
              {slider.label}
              <span className="tabular-nums text-muted">
                {settings[slider.key]} {slider.unit}
              </span>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={settings[slider.key]}
              onChange={(event) => onChange({ ...settings, [slider.key]: Number(event.target.value) })}
              className="mt-1 w-full accent-foreground"
            />
            <span className="block text-[11px] leading-snug text-muted">{slider.hint}</span>
          </label>
        ))}
        <p className="rounded-md bg-surface-muted px-2 py-1 text-xs text-muted">
          Live mic level: <span className="tabular-nums text-foreground">{liveDb > -100 ? liveDb.toFixed(0) : "–"} dB</span>
        </p>
        <label className="flex items-center justify-between text-xs font-medium">
          Count-in measures
          <input
            type="number"
            min={1}
            max={4}
            value={settings.countInMeasures}
            onChange={(event) => onChange({ ...settings, countInMeasures: Math.max(1, Math.min(4, Number(event.target.value) || 1)) })}
            className="h-7 w-16 rounded-md border border-border bg-surface px-2 text-right tabular-nums"
          />
        </label>
        <label className="flex items-center justify-between text-xs font-medium">
          Accept octave errors (grade the note name only)
          <input type="checkbox" checked={settings.ignoreOctave} onChange={(event) => onChange({ ...settings, ignoreOctave: event.target.checked })} className="accent-foreground" />
        </label>
        <label className="flex items-center justify-between text-xs font-medium">
          Keep the click going while playing
          <input type="checkbox" checked={settings.clickDuringPlay} onChange={(event) => onChange({ ...settings, clickDuringPlay: event.target.checked })} className="accent-foreground" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onClose} className={buttonClass("secondary", "h-8")}>
          Done
        </button>
      </div>
    </div>
  );
}
