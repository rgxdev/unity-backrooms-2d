/**
 * Background "process" that periodically fires a random ambient anomaly —
 * a flickering light, a distant whisper, a far-off thud, a scream out in the
 * dark, a burst of TV static — independent of the monster director. Pure
 * atmosphere: it never affects monster behaviour or the win/lose state. Kept
 * engine-independent (no Phaser types) so the scheduling logic is unit
 * testable in isolation, same as `MonsterDirector`.
 *
 * Duplicated entries weight the roll — flicker/whisper/thud/footsteps stay
 * the common beat; scream/static/laugh/moan/bang/flash/howl are rarer jolts;
 * knock (three deliberate raps from inside a wall), breath (an exhale right
 * at your ear), shadow (a silhouette darting across the fog rim) and
 * lightsout (a long total-darkness wave with footsteps closing in) are the
 * rarest, biggest beats.
 */
export const ANOMALY_TYPES = [
  "flicker",
  "flicker",
  "whisper",
  "whisper",
  "thud",
  "thud",
  "footsteps",
  "footsteps",
  "scream",
  "static",
  "laugh",
  "moan",
  "bang",
  "flash",
  "howl",
  "knock",
  "knock",
  "breath",
  "shadow",
  "shadow",
  "lightsout",
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export interface ProcessDirectorConfig {
  minIntervalMs: number;
  maxIntervalMs: number;
}

export class ProcessDirector {
  private nextAt = -1;

  constructor(
    private readonly config: ProcessDirectorConfig,
    private readonly rng: () => number = Math.random,
  ) {}

  reset(): void {
    this.nextAt = -1;
  }

  /**
   * Call once per frame with the current scene time (ms). Returns the
   * anomaly to fire this frame, or null if none is due yet.
   */
  update(time: number): AnomalyType | null {
    if (this.nextAt < 0) {
      // First roll after level load — don't hit the player immediately.
      this.nextAt = time + this.rollInterval();
      return null;
    }
    if (time < this.nextAt) return null;
    this.nextAt = time + this.rollInterval();
    return this.rollType();
  }

  private rollInterval(): number {
    const { minIntervalMs, maxIntervalMs } = this.config;
    return minIntervalMs + this.rng() * (maxIntervalMs - minIntervalMs);
  }

  private rollType(): AnomalyType {
    const i = Math.floor(this.rng() * ANOMALY_TYPES.length);
    return ANOMALY_TYPES[Math.min(i, ANOMALY_TYPES.length - 1)]!;
  }
}
