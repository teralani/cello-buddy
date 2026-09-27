"use client";

import { useState } from "react";
import { BowStrokeSegmenter, type Stroke } from "@/lib/bowArticulation";
import { articulationModel } from "@/lib/models/articulation.generated";
import { postureModel } from "@/lib/models/posture.generated";
import ModelTestCamera from "@/components/model-test-camera";
import PitchMonitor from "@/components/pitch-monitor";

const postureNames = ["elbow angle", "bow elevation", "wrist angle", "thumb angle", "index curl", "pinky curl"];
const postureDefaults = [110, 25, 165, 145, 150, 135];
const articulationNames = ["duration ms", "mean speed", "median speed", "max speed", "speed variance", "speed p90", "mean acceleration", "max acceleration", "acceleration variance", "peak speed position", "movement distance", "direction"];
const articulationDefaults = [520, 0.002, 0.002, 0.004, 0.000001, 0.004, 0.00001, 0.00002, 0.000001, 0.5, 1, 1];

export default function ModelTestBench() {
  const [postureFeatures, setPostureFeatures] = useState(postureDefaults);
  const [articulationFeatures, setArticulationFeatures] = useState(articulationDefaults);
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const postureResult = postureModel.predict(postureFeatures);
  const articulationResult = articulationModel.predict(articulationFeatures);

  function updatePosture(index: number, value: string) {
    setPostureFeatures((current) => current.map((feature, featureIndex) => featureIndex === index ? Number(value) : feature));
  }

  function updateArticulation(index: number, value: string) {
    setArticulationFeatures((current) => current.map((feature, featureIndex) => featureIndex === index ? Number(value) : feature));
  }

  function simulateStroke() {
    const segmenter = new BowStrokeSegmenter();
    segmenter.setAudioActive(true, 1);
    const samples = [[0, 0], [0.16, 100], [0.34, 200], [0.52, 300], [0.3, 400], [0.08, 520]];
    let completed: Stroke | null = null;
    for (const [x, timestamp] of samples) completed = segmenter.push(x, timestamp) ?? completed;
    if (!completed) return;
    setStroke(completed);
    setArticulationFeatures([completed.durationMs, completed.meanSpeed, completed.medianSpeed, completed.maxSpeed, completed.speedVariance, completed.speedP90, completed.meanAcceleration, completed.maxAcceleration, completed.accelerationVariance, completed.peakSpeedPosition, completed.movementDistance, completed.direction]);
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-butter">Offline artifacts / browser inference</p>
        <h1 className="mt-2 font-display text-6xl uppercase leading-none sm:text-8xl">Model test bench</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">Exercise the same feature vectors used by the Web Worker. No webcam, microphone, or training data is collected on this page.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelPanel title="01 / Posture" architecture="Random Forest / 30 trees / max depth 4" trained={postureModel.trained} artifact="lib/models/posture.generated.ts">
          <p className="mb-4 text-xs text-ink-soft">Six world-landmark angles. Change a value, then inspect the exported classifier output.</p>
          <FeatureInputs names={postureNames} values={postureFeatures} onChange={updatePosture} min={0} max={180} step={1} />
          <Prediction result={postureResult} empty="No trained posture artifact loaded" />
        </ModelPanel>

        <ModelPanel title="02 / Articulation" architecture="Random Forest / stroke-level / DSP features" trained={articulationModel.trained} artifact="lib/models/articulation.generated.ts">
          <p className="mb-4 text-xs text-ink-soft">The segmenter turns wrist motion into one stroke. Edit its four features or run a real segmentation sample.</p>
          <FeatureInputs names={articulationNames} values={articulationFeatures} onChange={updateArticulation} min={0} max={indexMax(articulationFeatures)} step={0.001} />
          <button type="button" onClick={simulateStroke} className="mt-4 border-2 border-butter px-4 py-2 font-display text-2xl uppercase text-butter hover:bg-butter hover:text-night">Simulate stroke</button>
          {stroke ? <div className="mt-3 border-l-2 border-sky pl-3 text-xs text-ink-soft">Segmented {stroke.durationMs.toFixed(0)} ms</div> : null}
          <Prediction result={articulationResult} empty="No trained articulation artifact loaded" />
        </ModelPanel>
      </div>

      <div className="mt-6">
        <ModelTestCamera />
      </div>

      <div className="mt-6">
        <PitchMonitor />
      </div>

      <section className="mt-6 border-t-4 border-screen-edge pt-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Implementation title="Landmarks" body="MediaPipe world landmarks are converted to rotation-aware joint angles in lib/features.ts." />
          <Implementation title="DSP" body="Audio and wrist signals measure pitch, onsets, velocity, and stroke boundaries before classification." />
          <Implementation title="Export" body="Python scikit-learn artifacts are exported as plain JavaScript with m2cgen and run locally in the worker." />
        </div>
      </section>
    </div>
  );
}

function indexMax(values: number[]) {
  return values[0] > 100 ? 2000 : 1;
}

function FeatureInputs({ names, values, onChange, min, max, step }: { names: string[]; values: number[]; onChange: (index: number, value: string) => void; min: number; max: number; step: number }) {
  return <div className="grid gap-3">{names.map((name, index) => <label key={name} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-xs uppercase"><span className="text-ink-soft">{name}</span><input aria-label={name} type="range" min={min} max={max} step={step} value={values[index]} onChange={(event) => onChange(index, event.target.value)} className="accent-butter" /><input aria-label={`${name} value`} type="number" min={min} max={max} step={step} value={values[index]} onChange={(event) => onChange(index, event.target.value)} className="w-full border-2 border-screen-edge bg-screen px-2 py-1 text-right text-ink" /></label>)}</div>;
}

function Prediction({ result, empty }: { result: { label: string; probabilities: Record<string, number> } | null; empty: string }) {
  return <div className="mt-6 border-t-2 border-screen-edge pt-4">{result ? <><div className="flex items-end justify-between"><span className="text-xs uppercase tracking-widest text-ink-soft">Prediction</span><strong className="font-display text-4xl uppercase text-butter">{result.label}</strong></div><div className="mt-3 grid gap-2">{Object.entries(result.probabilities).map(([label, probability]) => <div key={label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs uppercase"><span>{label}</span><span className="h-2 bg-screen-edge"><span className="block h-full bg-butter" style={{ width: `${Math.max(0, Math.min(100, probability * 100))}%` }} /></span><span className="text-right text-ink-soft">{(probability * 100).toFixed(0)}%</span></div>)}</div></> : <p className="text-sm uppercase text-rose">{empty}</p>}</div>;
}

function ModelPanel({ title, architecture, trained, artifact, children }: { title: string; architecture: string; trained: boolean; artifact: string; children: React.ReactNode }) {
  return <section className="border-4 border-cabinet-edge bg-cabinet p-1 hard-shadow"><div className="bg-bezel p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-screen-edge pb-4"><div><h2 className="font-display text-4xl uppercase">{title}</h2><p className="text-xs uppercase tracking-widest text-ink-soft">{architecture}</p></div><span className={`border-2 px-2 py-1 text-[10px] uppercase tracking-widest ${trained ? "border-emerald-400 text-emerald-300" : "border-rose text-rose"}`}>{trained ? "trained" : "placeholder"}</span></div><p className="mt-3 text-[11px] text-ink-soft">{artifact}</p><div className="mt-5">{children}</div></div></section>;
}

function Implementation({ title, body }: { title: string; body: string }) {
  return <div className="border-l-2 border-butter pl-3"><h3 className="font-display text-3xl uppercase text-butter">{title}</h3><p className="mt-1 text-xs leading-relaxed text-ink-soft">{body}</p></div>;
}