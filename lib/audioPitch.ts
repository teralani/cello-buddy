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