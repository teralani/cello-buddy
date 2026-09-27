import { detectPitchNsdf, PitchSmoother, rmsOf, toDecibels, type PitchEstimate, type PitchOptions } from "@/lib/audioPitch";

export type MicPitchFrame = {
  /* Latest raw estimate for this frame, null when silent or unclear. */
  estimate: PitchEstimate | null;
  /* Median of the last few frames, steadier for display. */
  smoothedMidi: number | null;
  db: number;
  sampleRate: number;
};

export type MicPitchOptions = PitchOptions & {
  silenceDb?: number;
  intervalMs?: number;
  fftSize?: number;
};

/* Opens the microphone and reports a pitch estimate every few milliseconds.
   Shared by the practice engine's tuning aids and the model test bench. */
export async function startMicPitch(onFrame: (frame: MicPitchFrame) => void, options: MicPitchOptions = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const context = new AudioContext();
  await context.resume();
  const analyser = context.createAnalyser();
  analyser.fftSize = options.fftSize ?? 4096;
  analyser.smoothingTimeConstant = 0;
  context.createMediaStreamSource(stream).connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  const smoother = new PitchSmoother(5);
  const silenceDb = options.silenceDb ?? -55;

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    const db = toDecibels(rmsOf(buffer));
    const estimate = db < silenceDb ? null : detectPitchNsdf(buffer, context.sampleRate, options);
    onFrame({ estimate, smoothedMidi: smoother.push(estimate?.midi ?? null), db, sampleRate: context.sampleRate });
  }, options.intervalMs ?? 30);

  return () => {
    window.clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    void context.close().catch(() => undefined);
  };
}
