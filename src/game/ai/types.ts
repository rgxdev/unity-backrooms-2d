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

/** The Hound (Level 1+, wiki entity-8) — faster and noise-drawn, shorter
 *  sighted than the default lurker; briefly deterred by direct eye contact
 *  in-fiction (not yet a gameplay mechanic). */
export const HOUND_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 76,
  chaseSpeed: 150,
  searchSpeed: 100,
  sightRange: 200,
  hearingRange: 260,
  reachRadius: 6,
};

/** The Smiler (Level 0, wiki entity-3) — drawn to light, so it acquires the
 *  player from further off than the default lurker; chases hard once it has,
 *  since canonically a fleeing/panicking target is what triggers its attack. */
export const SMILER_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 52,
  chaseSpeed: 140,
  searchSpeed: 90,
  sightRange: 300,
  hearingRange: 150,
  reachRadius: 6,
};

/** The Faceling (Level 1, wiki entity-9) — harmless mimic-of-wanderers;
 *  brisk, curious patrol but weak and "relatively easy to evade" even
 *  provoked, so its chase speed stays low. See {@link MonsterKindConfig.harmless}
 *  in constants.ts, which is what actually keeps it non-lethal. */
export const FACELING_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 60,
  chaseSpeed: 70,
  searchSpeed: 65,
  sightRange: 200,
  hearingRange: 160,
  reachRadius: 6,
};

/** The Skin-Stealer (Level 1, wiki entity-10) — docile aimless wandering by
 *  default, but hunts with real speed once provoked (canonically: kills with
 *  bare-hand strength in its hunger state). See {@link MonsterKindConfig.avoidGaze}
 *  in constants.ts for the "avoid eye contact" survival mechanic. */
export const SKINSTEALER_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 48,
  chaseSpeed: 132,
  searchSpeed: 80,
  sightRange: 240,
  hearingRange: 170,
  reachRadius: 6,
};

/** The Deathmoth (Level 2, wiki entity-4) — small, erratic, fast-fluttering
 *  swarm creature; short sight/hearing since it isn't hunting so much as
 *  clustering. Always {@link MonsterKindConfig.harmless} — contact is a
 *  startle beat, not a threat. */
export const DEATHMOTH_TUNING: MonsterTuning = {
  ai: DEFAULT_AI_CONFIG,
  patrolSpeed: 95,
  chaseSpeed: 60,
  searchSpeed: 70,
  sightRange: 140,
  hearingRange: 90,
  reachRadius: 6,
};

/**
 * Every distinct monster identity a level spawn can carry. `lurker` is the
 * generic ambient default; `pursuer` is the level-agnostic scripted chase
 * finale. The rest are per-level roster kinds sourced from the documented
 * Backrooms-wiki entity roster for each level (see tasks/research-canon.md)
 * — tuning/tint/behavior flags for each live in constants.ts's
 * `MONSTER_KIND_CONFIG`, roster weights in `game/levels/roster.ts`.
 */
export type MonsterKind =
  | "pursuer"
  | "lurker"
  | "hound"
  | "smiler"
  | "faceling"
  | "skinstealer"
  | "deathmoth";
