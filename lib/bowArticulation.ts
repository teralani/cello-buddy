export type Stroke = { durationMs: number; meanSpeed: number; speedVariance: number; noteOnsetCount: number };
export type Articulation = "staccato" | "legato" | "hooked" | "detache" | "unknown";

export class BowStrokeSegmenter {
  private lastX: number | null = null;
  private lastTime = 0;
  private direction = 0;
  private startedAt = 0;
  private speeds: number[] = [];
  private onsetCount = 0;

  addOnset() { this.onsetCount += 1; }

  push(x: number, timestamp: number): Stroke | null {
    if (this.lastX === null) { this.lastX = x; this.lastTime = timestamp; this.startedAt = timestamp; return null; }
    const deltaTime = timestamp - this.lastTime;
    const speed = deltaTime > 0 ? (x - this.lastX) / deltaTime : 0;
    const nextDirection = Math.abs(speed) > 0.0003 ? Math.sign(speed) : this.direction;
    const reversed = this.direction !== 0 && nextDirection !== this.direction;
    this.lastX = x; this.lastTime = timestamp;
    if (!reversed) { this.direction = nextDirection; this.speeds.push(Math.abs(speed)); return null; }
    const durationMs = timestamp - this.startedAt;
    const speeds = this.speeds.length ? this.speeds : [0];
    const meanSpeed = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
    const speedVariance = speeds.reduce((sum, value) => sum + (value - meanSpeed) ** 2, 0) / speeds.length;
    this.startedAt = timestamp; this.speeds = []; this.direction = nextDirection;
    if (durationMs < 80) return null;
    const stroke = { durationMs, meanSpeed, speedVariance, noteOnsetCount: this.onsetCount };
    this.onsetCount = 0;
    return stroke;
  }
}