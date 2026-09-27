"use client";

import { useEffect, useState } from "react";
import { startMicPitch, type MicPitchFrame } from "@/lib/micPitch";
import { midiToName } from "@/lib/scoreTimeline";

const idle: MicPitchFrame = { estimate: null, smoothedMidi: null, db: -120, sampleRate: 48000 };

/* Live readout of the microphone pitch detector: note name, cents off,
   frequency, clarity, and level. Uses the same detector as the practice
   engine, so what shows here is what the grader sees. */
export default function PitchMonitor() {
  const [frame, setFrame] = useState<MicPitchFrame>(idle);
  const [status, setStatus] = useState("starting");
  const [minClarity, setMinClarity] = useState(0.6);
  const [peak, setPeak] = useState<{ midi: number; count: number } | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let active = true;
    startMicPitch(
      (next) => {
        if (!active) return;
        setFrame(next);
        if (next.smoothedMidi !== null) {
          const rounded = Math.round(next.smoothedMidi);
          setPeak((current) => (current && current.midi === rounded ? { midi: rounded, count: current.count + 1 } : { midi: rounded, count: 1 }));
        }
      },
      { minClarity, minFrequency: 55, maxFrequency: 1500 },
    )
      .then((stopper) => {
        if (!active) {
          stopper();
          return;
        }
        stop = stopper;
        setStatus("live");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? `mic blocked: ${error.message}` : "mic blocked"));
    return () => {
      active = false;
      stop?.();
    };
  }, [minClarity]);

  const midi = frame.smoothedMidi;
  const cents = midi !== null ? (midi - Math.round(midi)) * 100 : null;
  const clarity = frame.estimate?.clarity ?? null;
  const level = Math.max(0, Math.min(100, ((frame.db + 80) / 80) * 100));

  return (
    <section className="border-4 border-cabinet-edge bg-cabinet p-1 hard-shadow">
      <div className="bg-bezel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-screen-edge pb-4">
          <div>
            <h2 className="font-display text-4xl uppercase">03 / Pitch</h2>
            <p className="text-xs uppercase tracking-widest text-ink-soft">McLeod NSDF / 4096 samples / live microphone</p>
          </div>
          <span className={`border-2 px-2 py-1 text-[10px] uppercase tracking-widest ${status === "live" ? "border-emerald-400 text-emerald-300" : "border-rose text-rose"}`}>{status}</span>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="min-w-[10rem]">
            <p className="text-xs uppercase tracking-widest text-ink-soft">Heard</p>
            <p className="font-display text-7xl uppercase leading-none text-butter">{midi !== null ? midiToName(midi) : "–"}</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-ink-soft">
              {frame.estimate ? `${frame.estimate.frequency.toFixed(1)} Hz` : "no pitch"}
            </p>
          </div>

          <div className="grid gap-3 text-xs uppercase">
            <Meter label="Cents" value={cents === null ? null : `${cents >= 0 ? "+" : ""}${cents.toFixed(0)}¢`} fraction={cents === null ? null : (cents + 50) / 100} centered />
            <Meter label="Clarity" value={clarity === null ? null : clarity.toFixed(2)} fraction={clarity} />
            <Meter label="Level" value={`${frame.db > -100 ? frame.db.toFixed(0) : "–"} dB`} fraction={level / 100} />
            <label className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3">
              <span className="text-ink-soft">min clarity</span>
              <input aria-label="minimum clarity" type="range" min={0.3} max={0.95} step={0.05} value={minClarity} onChange={(event) => setMinClarity(Number(event.target.value))} className="accent-butter" />
              <span className="text-right tabular-nums">{minClarity.toFixed(2)}</span>
            </label>
          </div>
        </div>

        <p className="mt-4 border-t-2 border-screen-edge pt-3 text-[11px] text-ink-soft">
          {peak ? `Steady on ${midiToName(peak.midi)} for ${peak.count} frames. ` : ""}
          Bow a long open string: the note should hold without flipping octaves. Lower the clarity floor if a bowed note reads as no pitch.
        </p>
      </div>
    </section>
  );
}

function Meter({ label, value, fraction, centered = false }: { label: string; value: string | null; fraction: number | null; centered?: boolean }) {
  const width = fraction === null ? 0 : Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className="relative h-2 bg-screen-edge">
        {centered ? <span className="absolute left-1/2 top-0 h-full w-px bg-ink-soft" /> : null}
        {centered ? (
          <span className="absolute top-0 h-full w-1 bg-butter" style={{ left: `calc(${width}% - 2px)`, opacity: fraction === null ? 0 : 1 }} />
        ) : (
          <span className="block h-full bg-butter" style={{ width: `${width}%` }} />
        )}
      </span>
      <span className="text-right tabular-nums text-ink-soft">{value ?? "–"}</span>
    </div>
  );
}
