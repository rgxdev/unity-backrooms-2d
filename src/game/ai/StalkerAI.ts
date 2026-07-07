/**
 * The Stalker: a "don't look away" horror mechanic (SCP-173 / Weeping Angel
 * style). It never moves while the player has line of sight on it — it only
 * closes the distance the instant it drops out of view. The scare isn't a
 * chase, it's the dawning realisation that it's closer every time you look
 * back.
 *
 * Pure, engine-independent logic — the scene owns line-of-sight, movement and
 * effects; this only decides intent from a per-tick {@link StalkerPerception}.
 */
export const StalkerState = {
  /** Dormant — too far away to be in play yet. */
  Lurking: "lurking",
  /** Unseen and within range — creeping toward the player. */
  Creeping: "creeping",
  /** In the player's line of sight — must not move a muscle. */
  Frozen: "frozen",
  /** Got within grab range while unseen — the scare beat. */
  Lunging: "lunging",
  /** Post-lunge cooldown, off-stage before it can lurk again. */
  Retreating: "retreating",
} as const;

export type StalkerState = (typeof StalkerState)[keyof typeof StalkerState];

export interface StalkerPerception {
  /** The player currently has unobstructed line of sight on it. */
  seen: boolean;
  /** World-unit distance to the player. */
  distanceToPlayer: number;
}

export interface StalkerConfig {
  /** Distance at which a lurking stalker arms itself and starts stalking. */
  triggerRadius: number;
  /** Distance at which an unseen stalker lunges (the scare). */
  grabRadius: number;
  /** Seconds the Lunging beat holds before retreating. */
  lungeDuration: number;
  /** Seconds spent off-stage after a lunge before it can lurk again. */
  retreatCooldown: number;
}

export const DEFAULT_STALKER_CONFIG: StalkerConfig = {
  triggerRadius: 340,
  grabRadius: 30,
  lungeDuration: 0.6,
  retreatCooldown: 9,
};

/**
 * Deterministic Stalker brain. Pure logic (no Phaser refs) so the "don't
 * look away" transitions can be unit tested in isolation.
 */
export class StalkerAI {
  private state: StalkerState = StalkerState.Lurking;
  private timer = 0;
  private readonly config: StalkerConfig;

  constructor(config: StalkerConfig = DEFAULT_STALKER_CONFIG) {
    this.config = config;
  }

  get current(): StalkerState {
    return this.state;
  }

  reset(): void {
    this.state = StalkerState.Lurking;
    this.timer = 0;
  }

  private transition(next: StalkerState): void {
    if (next !== this.state) {
      this.state = next;
      this.timer = 0;
    }
  }

  update(delta: number, perception: StalkerPerception): StalkerState {
    this.timer += delta;
    const { triggerRadius, grabRadius, lungeDuration, retreatCooldown } =
      this.config;
    const { seen, distanceToPlayer: dist } = perception;

    switch (this.state) {
      case StalkerState.Lurking:
        if (dist <= triggerRadius) {
          this.transition(seen ? StalkerState.Frozen : StalkerState.Creeping);
        }
        break;

      case StalkerState.Creeping:
        if (seen) this.transition(StalkerState.Frozen);
        else if (dist <= grabRadius) this.transition(StalkerState.Lunging);
        break;

      case StalkerState.Frozen:
        // Perfectly still while watched, however close it already is. The
        // instant the player looks away, it either lunges (already in grab
        // range) or resumes creeping.
        if (!seen) {
          this.transition(
            dist <= grabRadius ? StalkerState.Lunging : StalkerState.Creeping,
          );
        }
        break;

      case StalkerState.Lunging:
        if (this.timer >= lungeDuration)
          this.transition(StalkerState.Retreating);
        break;

      case StalkerState.Retreating:
        if (this.timer >= retreatCooldown)
          this.transition(StalkerState.Lurking);
        break;
    }

    return this.state;
  }
}
