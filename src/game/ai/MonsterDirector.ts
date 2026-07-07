/**
 * Scripted-dread pacing controller. The monsters are *not* reactive hunters:
 * for most of the level they only patrol and give the player fleeting glimpses
 * and sounds. Only once the player reaches the level's end (the pursuit
 * trigger) does the monster wake and chase to the exit — producing the
 * "I only just escaped" beat. The player never dies.
 *
 * Kept engine-independent so the phase logic is unit testable.
 */
export const GamePhase = {
  /** Monsters patrol and are indifferent to the player. */
  Ambient: "ambient",
  /** The end is near — monsters relentlessly chase the player to the exit. */
  Pursuit: "pursuit",
  /** The player reached the exit and got away. Terminal. */
  Escaped: "escaped",
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface DirectorSignals {
  /** Player is inside the zone that arms the chase. */
  inPursuitTrigger: boolean;
  /** Player is standing on the exit. */
  atExit: boolean;
}

export class MonsterDirector {
  private phase: GamePhase = GamePhase.Ambient;

  get current(): GamePhase {
    return this.phase;
  }

  reset(): void {
    this.phase = GamePhase.Ambient;
  }

  update(signals: DirectorSignals): GamePhase {
    switch (this.phase) {
      case GamePhase.Ambient:
        // Reaching the exit always ends the level, even before a chase begins.
        if (signals.atExit) this.phase = GamePhase.Escaped;
        else if (signals.inPursuitTrigger) this.phase = GamePhase.Pursuit;
        break;
      case GamePhase.Pursuit:
        if (signals.atExit) this.phase = GamePhase.Escaped;
        break;
      case GamePhase.Escaped:
        break;
    }
    return this.phase;
  }
}
