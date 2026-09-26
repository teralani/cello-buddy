export type PitchSample = {
  frequency: number;
  midi: number;
  note: string;
  cents: number;
  timestamp: number;
};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function detectPitch(buffer: Float32Array, sampleRate: number, timestamp = performance.now()): PitchSample | null {
  let rms = 0;
  for (const value of buffer) rms += value * value;
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.015) return null;

  let bestOffset = -1;
  let bestCorrelation = 0;
  const minOffset = Math.floor(sampleRate / 1000);
  const maxOffset = Math.min(Math.floor(sampleRate / 60), buffer.length - 1);
  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;
    for (let index = 0; index < buffer.length - offset; index += 1) correlation += buffer[index] * buffer[index + offset];
    correlation /= buffer.length - offset;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  if (bestOffset < 0 || bestCorrelation < 0.01) return null;
  const frequency = sampleRate / bestOffset;
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const nearestMidi = Math.round(midi);
  return { frequency, midi, note: `${noteNames[nearestMidi % 12]}${Math.floor(nearestMidi / 12) - 1}`, cents: (midi - nearestMidi) * 100, timestamp };
}

export class IntonationTracker {
  private readonly buckets = new Map<string, { sumCents: number; count: number }>();

  add(sample: PitchSample) {
    const openStrings = [{ name: "C", midi: 36 }, { name: "G", midi: 43 }, { name: "D", midi: 50 }, { name: "A", midi: 57 }];
    const string = [...openStrings].reverse().find((candidate) => sample.midi >= candidate.midi)?.name ?? "C";
    const noteClass = noteNames[Math.round(sample.midi) % 12];
    const key = `${string}:${noteClass}`;
    const bucket = this.buckets.get(key) ?? { sumCents: 0, count: 0 };
    bucket.sumCents += sample.cents;
    bucket.count += 1;
    this.buckets.set(key, bucket);
  }

  getAverage(string: string, noteClass: string) {
    const bucket = this.buckets.get(`${string}:${noteClass}`);
    return bucket ? bucket.sumCents / bucket.count : null;
  }
}

export function detectOnset(previousRms: number, currentRms: number, timestamp: number, lastOnset: number) {
  return currentRms - previousRms > 0.035 && timestamp - lastOnset >= 120;
}
/* Normalized square difference (McLeod) pitch detection. More robust than
   plain autocorrelation on low cello strings, where the strong second
   harmonic often wins a raw correlation peak. Returns null when the frame
   is too quiet or too noisy to be trusted. */
export type PitchEstimate = { frequency: number; midi: number; clarity: number };

export function detectPitchNsdf(
  buffer: Float32Array,
  sampleRate: number,
  options: { minFrequency?: number; maxFrequency?: number; minClarity?: number } = {},
): PitchEstimate | null {
  const minFrequency = options.minFrequency ?? 55;
  const maxFrequency = options.maxFrequency ?? 1400;
  const minClarity = options.minClarity ?? 0.85;
  const size = buffer.length;
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(Math.floor(sampleRate / minFrequency), size - 2);
  if (maxLag <= minLag) return null;

  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let acf = 0;
    let energy = 0;
    for (let index = 0; index < size - lag; index += 1) {
      const a = buffer[index];
      const b = buffer[index + lag];
      acf += a * b;
      energy += a * a + b * b;
    }
    nsdf[lag] = energy > 0 ? (2 * acf) / energy : 0;
  }

  /* Peak picking: the first strong key maximum after the first negative zero crossing. */
  const peaks: number[] = [];
  let lag = minLag;
  while (lag <= maxLag && nsdf[lag] > 0) lag += 1;
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag] <= 0) lag += 1;
    let best = -1;
    let bestValue = 0;
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > bestValue) {
        bestValue = nsdf[lag];
        best = lag;
      }
      lag += 1;
    }
    if (best > 0) peaks.push(best);
  }
  if (peaks.length === 0) return null;

  const highest = Math.max(...peaks.map((peak) => nsdf[peak]));
  const threshold = highest * 0.9;
  const chosen = peaks.find((peak) => nsdf[peak] >= threshold);
  if (chosen === undefined) return null;
  const clarity = nsdf[chosen];
  if (clarity < minClarity) return null;

  /* Parabolic interpolation around the chosen lag for sub-sample accuracy. */
  let refined = chosen;
  if (chosen > minLag && chosen < maxLag) {
    const left = nsdf[chosen - 1];
    const center = nsdf[chosen];
    const right = nsdf[chosen + 1];
    const denominator = left - 2 * center + right;
    if (denominator !== 0) refined = chosen + (0.5 * (left - right)) / denominator;
  }

  const frequency = sampleRate / refined;
  if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) return null;
  return { frequency, midi: 69 + 12 * Math.log2(frequency / 440), clarity };
}

export function rmsOf(buffer: Float32Array) {
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) sum += buffer[index] * buffer[index];
  return Math.sqrt(sum / buffer.length);
}

export function toDecibels(rms: number) {
  return rms > 0 ? 20 * Math.log10(rms) : -120;
}
