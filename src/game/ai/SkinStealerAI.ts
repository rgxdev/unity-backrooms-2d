/**
 * The Skin-Stealer: an "avoid eye contact" horror mechanic — the opposite
 * trigger direction from the Stalker (see StalkerAI, which punishes looking
 * *away*). Per wiki canon (entity-10's docile/hunger-state duality plus
 * `level-1`'s own survival advice: "avoid eye contact, do not engage"), it
 * wanders docile until the player holds sustained, unobstructed direct sight
 * on it — at which point it "notices" and lunges.
 *
 * Pure, engine-independent logic, mirroring StalkerAI's split: the scene owns
 * line-of-sight, movement and effects; this only decides intent from a
 * per-tick {@link SkinStealerPerception}.
 */
export const SkinStealerState = {
  /** Default state — ambient patrol, no special behavior. */
  Docile: "docile",
  /** Noticed the player staring — the scare beat. */
  Lunging: "lunging",
  /** Post-lunge cooldown before it can be gaze-triggered again. */
  Retreating: "retreating",
} as const;

export type SkinStealerState =
  (typeof SkinStealerState)[keyof typeof SkinStealerState];

export interface SkinStealerPerception {
  /** The player currently has sustained, unobstructed direct line of sight on
   *  it (same "seen" definition the Stalker uses: LOS + within the fog reveal
   *  radius). */
  gazed: boolean;
}

export interface SkinStealerConfig {
  /** Seconds of *continuous* direct gaze before it notices and lunges. */
  gazeThreshold: number;
  /** Seconds the lunge scare beat holds before it backs off. */
  lungeDuration: number;
  /** Seconds of cooldown after a lunge before gaze can trigger it again. */
  retreatCooldown: number;
}

export const DEFAULT_SKINSTEALER_CONFIG: SkinStealerConfig = {
  // ~1.75s of uninterrupted direct sight — long enough that a passing glance
  // never triggers it, short enough that deliberately staring clearly does.
  gazeThreshold: 1.75,
  lungeDuration: 0.6,
  retreatCooldown: 8,
};

/**
 * Deterministic Skin-Stealer brain. Pure logic (no Phaser refs) so the
 * "avoid eye contact" transitions can be unit tested in isolation, mirroring
 * StalkerAI.test.ts's approach.
 */
export class SkinStealerAI {
  private state: SkinStealerState = SkinStealerState.Docile;
  private timer = 0;
  /** Seconds of gaze accumulated so far this Docile stretch — resets the
   *  instant the gaze breaks, since only *continuous* sight should count. */
  private gazeTimer = 0;
  private readonly config: SkinStealerConfig;

  constructor(config: SkinStealerConfig = DEFAULT_SKINSTEALER_CONFIG) {
    this.config = config;
  }

  get current(): SkinStealerState {
    return this.state;
  }

  reset(): void {
    this.state = SkinStealerState.Docile;
    this.timer = 0;
    this.gazeTimer = 0;
  }

  private transition(next: SkinStealerState): void {
    if (next !== this.state) {
      this.state = next;
      this.timer = 0;
    }
  }

  update(delta: number, perception: SkinStealerPerception): SkinStealerState {
    this.timer += delta;
    const { gazeThreshold, lungeDuration, retreatCooldown } = this.config;

    switch (this.state) {
      case SkinStealerState.Docile:
        if (perception.gazed) {
          this.gazeTimer += delta;
          if (this.gazeTimer >= gazeThreshold) {
            this.gazeTimer = 0;
            this.transition(SkinStealerState.Lunging);
          }
        } else {
          // Looking away resets the count — only sustained, continuous sight
          // should be able to provoke it.
          this.gazeTimer = 0;
        }
        break;

      case SkinStealerState.Lunging:
        if (this.timer >= lungeDuration)
          this.transition(SkinStealerState.Retreating);
        break;

      case SkinStealerState.Retreating:
        if (this.timer >= retreatCooldown)
          this.transition(SkinStealerState.Docile);
        break;
    }

    return this.state;
  }
}
