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

/**
 * Scene-side movement/perception tuning. Kept separate from {@link AiConfig} so
 * the state machine stays pure — this only shapes how the entity acts on the
 * state the FSM chose.
 */
export interface MonsterTuning {
  ai: AiConfig;
  /** Move speeds (world units/sec) per behaviour. */
  patrolSpeed: number;
  chaseSpeed: number;
  searchSpeed: number;
  /** Max world distance the monster can acquire the player by sight. */
  sightRange: number;
  /** World-unit radius at which the monster registers a noise event. */
  hearingRange: number;
  /** World distance at which a waypoint / target counts as reached. */
  reachRadius: number;
}

export const DEFAULT_MONSTER_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 52,
  chaseSpeed: 118,
  searchSpeed: 74,
  sightRange: 260,
  hearingRange: 180,
  reachRadius: 6,
};

/** The Hound (see constants.ts's {@link HOUND}) — faster and noise-drawn,
 *  shorter sighted than the default lurker. */
export const HOUND_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 76,
  chaseSpeed: 150,
  searchSpeed: 100,
  sightRange: 200,
  hearingRange: 260,
  reachRadius: 6,
};
