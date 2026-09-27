export type Stroke = {
  durationMs: number;
  meanSpeed: number;
  medianSpeed: number;
  maxSpeed: number;
  speedVariance: number;
  speedP90: number;
  meanAcceleration: number;
  maxAcceleration: number;
  accelerationVariance: number;
  peakSpeedPosition: number;
  movementDistance: number;
  direction: number;
};
export type Articulation = "staccato" | "legato" | "detache" | "unknown";

export class BowStrokeSegmenter {
  private lastX: number | null = null;
  private lastTime = 0;
  private direction = 0;
  private startedAt = 0;
  private speeds: number[] = [];
  private accelerations: number[] = [];
  private audioActive = false;
  private reversalDirection = 0;
  private reversalSince = 0;
  private reversalDistance = 0;

  setAudioActive(active: boolean, timestamp: number): Stroke | null {
    if (active === this.audioActive) return null;
    this.audioActive = active;
    if (active) this.reset(timestamp);
    return null;
  }

  push(x: number, timestamp: number): Stroke | null {
    if (!this.audioActive) return null;
    if (this.lastX === null) { this.lastX = x; this.lastTime = timestamp; return null; }
    const deltaTime = timestamp - this.lastTime;
    const speed = deltaTime > 0 ? (x - this.lastX) / deltaTime : 0;
    const previousSpeed = this.speeds[this.speeds.length - 1] ?? 0;
    const acceleration = deltaTime > 0 ? (speed - previousSpeed) / deltaTime : 0;
    const nextDirection = Math.abs(speed) > 0.00008 ? Math.sign(speed) : 0;
    this.lastX = x;
    this.lastTime = timestamp;
    if (nextDirection && this.direction && nextDirection !== this.direction) {
      if (this.reversalDirection !== nextDirection) {
        this.reversalDirection = nextDirection;
        this.reversalSince = timestamp;
        this.reversalDistance = 0;
      }
      this.reversalDistance += Math.abs(speed * deltaTime);
    } else {
      this.reversalDirection = 0;
      this.reversalDistance = 0;
    }
    const confirmed = this.direction && this.reversalDirection && timestamp - this.reversalSince >= 70 && this.reversalDistance >= 0.003;
    if (confirmed) {
      const stroke = this.finish(timestamp, nextDirection);
      this.startedAt = timestamp;
      return stroke;
    }
    if (nextDirection) {
      if (!this.startedAt) this.startedAt = timestamp;
      if (!this.direction) this.direction = nextDirection;
      this.speeds.push(speed);
      this.accelerations.push(acceleration);
    }
    return null;
  }

  private reset(timestamp: number) {
    this.lastX = null;
    this.lastTime = timestamp;
    this.direction = 0;
    this.startedAt = 0;
    this.speeds = [];
    this.accelerations = [];
    this.reversalDirection = 0;
    this.reversalSince = 0;
    this.reversalDistance = 0;
  }

  private finish(timestamp: number, nextDirection: number): Stroke | null {
    if (!this.startedAt) return null;
    const values = this.speeds.length ? this.speeds.map(Math.abs) : [0];
    const accelerations = this.accelerations.map(Math.abs);
    const ordered = [...values].sort((a, b) => a - b);
    const meanSpeed = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanAcceleration = accelerations.length ? accelerations.reduce((sum, value) => sum + value, 0) / accelerations.length : 0;
    const speedVariance = values.reduce((sum, value) => sum + (value - meanSpeed) ** 2, 0) / values.length;
    const accelerationVariance = accelerations.length ? accelerations.reduce((sum, value) => sum + (value - meanAcceleration) ** 2, 0) / accelerations.length : 0;
    const maxSpeed = Math.max(...values);
    const peakIndex = values.indexOf(maxSpeed);
    const durationMs = timestamp - this.startedAt;
    this.speeds = [];
    this.accelerations = [];
    this.direction = nextDirection;
    this.reversalDirection = 0;
    this.reversalDistance = 0;
    if (durationMs < 120) return null;
    return {
      durationMs,
      meanSpeed,
      medianSpeed: ordered[Math.floor(ordered.length / 2)],
      maxSpeed,
      speedVariance,
      speedP90: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.9))],
      meanAcceleration,
      maxAcceleration: accelerations.length ? Math.max(...accelerations) : 0,
      accelerationVariance,
      peakSpeedPosition: peakIndex / Math.max(1, values.length - 1),
      movementDistance: values.reduce((sum, value) => sum + value, 0),
      direction: this.direction,
    };
  }
}

export function articulationFeatureVector(stroke: Stroke) {
  return [stroke.durationMs, stroke.meanSpeed, stroke.medianSpeed, stroke.maxSpeed, stroke.speedVariance, stroke.speedP90, stroke.meanAcceleration, stroke.maxAcceleration, stroke.accelerationVariance, stroke.peakSpeedPosition, stroke.movementDistance, stroke.direction];
}
