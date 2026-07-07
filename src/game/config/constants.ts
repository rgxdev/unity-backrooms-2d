import type { Difficulty } from "@/lib/schemas/settings";

export const TILE_SIZE = 32;

export const PLAYER = {
  size: 18,
  speed: 140,
  sprintSpeed: 215,
  bodyInset: 3,
  /** World-unit radius a monster can hear the player sprint. */
  noiseRadius: 150,
  /** Velocity ramp-up when accelerating into a direction (units/sec^2). */
  acceleration: 1500,
  /** Velocity ramp-down when stopping/turning (units/sec^2) — snappier than
   *  acceleration so stops feel responsive, not floaty. */
  deceleration: 2100,
} as const;

export const MONSTER = {
  size: 22,
  bodyInset: 4,
} as const;

/** Scripted-dread pacing knobs (see MonsterDirector). */
export const DREAD = {
  /** World radius within which the player can hear the lurking monster. */
  presenceRadius: 210,
  /** Min gap between ambient presence cues (ms). */
  cueCooldownMs: 4500,
  /** World distance at which a pursuing monster grabs the player (lethal on
   *  middle/hard). */
  killRadius: 17,
} as const;

/**
 * Per-difficulty level-generation and threat tuning. Higher difficulty =
 * larger, more complex levels, more monsters, and — crucially — a lethal
 * chase. Easy is never lethal. Sizes grow with the level index too, so later
 * Backrooms levels are longer and harder.
 */
export interface DifficultyConfig {
  /** Can the monster catch, attack and kill the player? */
  lethal: boolean;
  /** Chase speed (world units/sec). Player sprint is 215. */
  pursuitSpeed: number;
  base: {
    width: number;
    height: number;
    rooms: number;
    monsters: number;
    /** Extra (loop-forming) corridors beyond the spanning path. */
    extraLinks: number;
  };
  /** Added per level index (0-based). */
  perLevel: { width: number; height: number; rooms: number; monsters: number };
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    lethal: false,
    pursuitSpeed: 150,
    base: { width: 34, height: 26, rooms: 7, monsters: 2, extraLinks: 2 },
    perLevel: { width: 3, height: 2, rooms: 1, monsters: 0 },
  },
  middle: {
    lethal: true,
    pursuitSpeed: 160,
    base: { width: 46, height: 34, rooms: 10, monsters: 3, extraLinks: 3 },
    perLevel: { width: 4, height: 3, rooms: 1, monsters: 1 },
  },
  hard: {
    lethal: true,
    pursuitSpeed: 172,
    base: { width: 58, height: 42, rooms: 14, monsters: 4, extraLinks: 4 },
    perLevel: { width: 5, height: 3, rooms: 2, monsters: 1 },
  },
} as const;

/**
 * Jump-scare encounters: a monster flashes into view near the player for a
 * few seconds and vanishes again — distinct from the persistent patrol/pursuit
 * monsters. Above easy, getting too close during the window triggers an
 * attack. Purely a tension beat; scaled up near the exit (see EXIT_DREAD).
 */
export const JUMPSCARE = {
  minIntervalMs: 7000,
  maxIntervalMs: 15000,
  minVisibleMs: 1700,
  maxVisibleMs: 3200,
  /** World-unit distance at which an above-easy encounter attacks. */
  attackRadius: 60,
  /** Tile-distance band from the player it can appear within — close enough
   *  to be seen, far enough to feel like it was already there. */
  spawnMinRadiusTiles: 3,
  spawnMaxRadiusTiles: 5.5,
} as const;

/** Monster activity ramps up as the player nears the exit. */
export const EXIT_DREAD = {
  /** Tile-distance from the exit at which activity starts ramping up. */
  radiusTiles: 14,
  /** Jump-scare interval shrinks to this fraction of normal at the exit. */
  minIntervalScale: 0.4,
  /** Ambient patrol speed multiplier at the exit. */
  maxSpeedBoost: 0.6,
} as const;

/** Never generate more monsters than this, whatever the difficulty/index. */
export const MAX_MONSTERS = 8;

export const COLORS = {
  // Woven carpet floor — warm mustard with visible thread weave
  floor: 0xc4b158,
  floorAlt: 0xbaa74f,
  floorWeaveHi: 0xd8c66d,
  floorWeaveLo: 0x9c8b3d,
  floorSeam: 0x83732f,
  // Worn plaster wall — soft rounded volume, not a flat stamped block
  wall: 0xdccd78,
  wallStripe: 0xcdbc63,
  wallHi: 0xf0e6a6,
  wallHi2: 0xe6d98c,
  wallShade: 0xa8964a,
  wallShade2: 0xbfae5e,
  wallDark: 0x7a692f,
  wallTrim: 0x5f5127,
  wallSpeckleHi: 0xf7efc0,
  wallSpeckleLo: 0x8f7e3e,
  // Top-down character sprite
  playerSkin: 0xe8b78a,
  playerSkinShade: 0xcf9b6f,
  playerHair: 0x5a3b22,
  playerHairHi: 0x7a5638,
  playerShirt: 0x4d84c4,
  playerShirtHi: 0x6aa2df,
  playerShirtShade: 0x38629a,
  playerPants: 0x3b3a58,
  playerPantsShade: 0x2b2a42,
  playerOutline: 0x1a180f,
  // Lurking monster
  monsterBody: 0x39304a,
  monsterBodyHi: 0x4a3f5e,
  monsterBodyShade: 0x271f33,
  monsterLimb: 0x2b2338,
  monsterEye: 0xff5230,
  monsterEyeGlow: 0xff8a5c,
  monsterMaw: 0xe8e2c4,
  monsterMawShade: 0xb8b190,
  shadow: 0x000000,
  // Bottomless hole (Level 0 "Hole Variation")
  holeRim: 0x2a2411,
  holeEdge: 0x0d0b06,
  holePit: 0x030302,
  // Flickering exit wall (the "throw yourself through" seam to Level 1)
  exitFrame: 0x2a2416,
  exitGlow: 0x6bf09a,
  exitCore: 0x9dffc0,
  fog: 0x05050a,
} as const;

/**
 * Multiplicative floor tints for the documented Level 0 sub-sections. Applied
 * on top of the base yellow carpet so each zone reads at a glance.
 */
export const ZONE_TINT: Record<string, number> = {
  red: 0xff5a4a, // sticky crimson Red Rooms
  manila: 0xf4e6b4, // warm, calm Manila Room
} as const;

/** Blackout Zones never fully light — visible tiles keep this residual fog. */
export const BLACKOUT_MIN_ALPHA = 0.62;

export const TEXTURES = {
  floor: "tex-floor",
  floorAlt: "tex-floor-alt",
  wall: "tex-wall",
  wallCrack: "tex-wall-crack",
  monster: "tex-monster",
  monsterWalk: "tex-monster-walk",
  monsterBack: "tex-monster-back",
  monsterBackWalk: "tex-monster-back-walk",
  exit: "tex-exit",
  hole: "tex-hole",
  rubble: "tex-rubble",
} as const;

/**
 * Player texture keys are generated per-skin (see `game/skins/skinCatalog`) —
 * one front/back/walk set per unlockable skin — instead of a fixed set, so
 * equipping a skin is just picking a different key, not swapping art.
 */
export function playerTextureKey(
  skinId: string,
  facing: "front" | "back",
  stride: boolean,
): string {
  return `tex-player-${skinId}-${facing}${stride ? "-walk" : ""}`;
}

/** Walk-cycle frame swap: how often the "stride" leg-offset frame alternates
 *  with the neutral frame while a character is moving. */
export const WALK_CYCLE_MS = 190;

/** Per-role monster tints (Phaser setTint) so pursuer / lurker / jump-scare
 *  read as distinct threats at a glance without new art per role. */
export const MONSTER_TINT = {
  pursuer: 0xff9d84, // hottest — the one that ends the level
  lurker: 0xffffff, // neutral — the default patrol threat
  jumpscare: 0xcbb8ff, // pale violet — the fleeting glimpse
} as const;

export const SCENES = {
  boot: "BootScene",
  preload: "PreloadScene",
  main: "MainScene",
} as const;

export const VISIBILITY = {
  revealRadiusTiles: 6,
  losStepTiles: 0.25,
  dimAlpha: 0.55,
  /** How long a tile's fog fades between states — the "cleaner" smooth reveal
   *  instead of an instant pop. */
  fadeMs: 260,
  /** Width (in tiles) of the soft vignette band at the edge of the reveal
   *  radius, so the sight radius reads as a gentle falloff, not a hard disc. */
  edgeFalloffTiles: 1.6,
} as const;
