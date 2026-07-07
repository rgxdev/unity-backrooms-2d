import type { Difficulty } from "@/lib/schemas/settings";

export const TILE_SIZE = 32;

export const PLAYER = {
  size: 14,
  speed: 140,
  sprintSpeed: 215,
  bodyInset: 2,
  /** World-unit radius a monster can hear the player sprint. */
  noiseRadius: 150,
} as const;

export const MONSTER = {
  size: 16,
  bodyInset: 3,
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
    base: { width: 34, height: 26, rooms: 6, monsters: 1, extraLinks: 1 },
    perLevel: { width: 3, height: 2, rooms: 1, monsters: 0 },
  },
  middle: {
    lethal: true,
    pursuitSpeed: 160,
    base: { width: 46, height: 34, rooms: 9, monsters: 2, extraLinks: 2 },
    perLevel: { width: 4, height: 3, rooms: 1, monsters: 1 },
  },
  hard: {
    lethal: true,
    pursuitSpeed: 172,
    base: { width: 58, height: 42, rooms: 12, monsters: 3, extraLinks: 3 },
    perLevel: { width: 5, height: 3, rooms: 2, monsters: 1 },
  },
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
  // Wallpaper wall block with pseudo-3D bevel
  wall: 0xdccd78,
  wallStripe: 0xcdbc63,
  wallHi: 0xf0e6a6,
  wallShade: 0xa8964a,
  wallDark: 0x7a692f,
  wallTrim: 0x5f5127,
  // Top-down character sprite
  playerSkin: 0xe8b78a,
  playerSkinShade: 0xcf9b6f,
  playerHair: 0x5a3b22,
  playerShirt: 0x4d84c4,
  playerShirtShade: 0x38629a,
  playerPants: 0x3b3a58,
  playerOutline: 0x1a180f,
  // Lurking monster
  monsterBody: 0x39304a,
  monsterBodyShade: 0x271f33,
  monsterLimb: 0x2b2338,
  monsterEye: 0xff5230,
  monsterMaw: 0xe8e2c4,
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
  player: "tex-player",
  monster: "tex-monster",
  exit: "tex-exit",
  hole: "tex-hole",
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
} as const;
