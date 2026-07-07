export const MonsterState = {
  Patrol: "patrol",
  Search: "search",
  Chase: "chase",
  Attack: "attack",
  Lost: "lost",
} as const;

export type MonsterState = (typeof MonsterState)[keyof typeof MonsterState];

/** Per-tick perception snapshot fed to the state machine. */
export interface Perception {
  canSeePlayer: boolean;
  distanceToPlayer: number;
  heardNoise: boolean;
}

export interface AiConfig {
  attackRange: number;
  chaseRange: number;
  /** Seconds spent searching a last-known position before giving up. */
  searchTimeout: number;
  /** Seconds in Lost before returning to Patrol. */
  lostTimeout: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  attackRange: 24,
  chaseRange: 220,
  searchTimeout: 4,
  lostTimeout: 2,
};
