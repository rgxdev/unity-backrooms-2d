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

/**
 * Visual identity per the documented Backrooms levels — every official level
 * gets its own wall/floor material and detailing, sourced from the wiki
 * entry for that level:
 *   lobby      — Level 0, The Lobby: mildew-yellow wallpaper, Berber carpet.
 *   habitable  — Level 1, The Habitable Zone: bare-concrete warehouse.
 *   pipedreams — Level 2, Pipe Dreams: grimy maintenance tunnel, rusted pipes.
 *   poolrooms  — Level 3, Poolrooms: pristine white ceramic tile.
 *   hazard     — Level 4, Run For Your Life: scorched concrete, hazard tape.
 * Drives which baked wall/floor/exit textures a level uses (see
 * {@link TEXTURES}).
 */
export const LEVEL_STYLES = [
  "lobby",
  "habitable",
  "pipedreams",
  "poolrooms",
  "hazard",
] as const;
export type LevelStyle = (typeof LEVEL_STYLES)[number];

/** Which decorative layer {@link StyleColorSet} draws on top of the base wall
 *  fill — the thing that makes each level's material read distinctly. */
export type WallPattern = "wallpaper" | "concrete" | "pipes" | "tile" | "hazard";
/** Which pattern {@link StyleColorSet} draws for a level's floor. */
export type FloorPattern = "weave" | "concrete" | "tile";

/**
 * 4-bit wall autotile mask: each bit is set when that cardinal neighbour is
 * NOT a wall (i.e. the wall tile's face is exposed to a room on that side).
 * A wall tile deep inside a solid mass has mask 0 and renders as a flat,
 * seamless slab — only exposed faces get a bevel/trim, so a bank of wall
 * tiles reads as one connected structure instead of individually outlined
 * blocks.
 */
export const WALL_MASK = { NORTH: 1, EAST: 2, SOUTH: 4, WEST: 8 } as const;
/** Every possible 4-bit neighbour combination — baked once per style at preload. */
export const WALL_MASK_COUNT = 16;

export interface StyleColorSet {
  /** Deterministic-noise seed offset so styles don't share identical grain. */
  seed: number;
  floor: number;
  floorWeaveHi: number;
  floorWeaveLo: number;
  floorStain: number;
  wall: number;
  wallStripe: number;
  wallStripeGap: number;
  wallHi: number;
  wallHi2: number;
  wallShade: number;
  wallShade2: number;
  wallDark: number;
  wallSpeckleHi: number;
  wallSpeckleLo: number;
  wallPattern: WallPattern;
  floorPattern: FloorPattern;
  /** Pattern-specific detail colour (pipe metal / tile grout / hazard tape). */
  accent: number;
  /** Secondary pattern-specific detail colour (pipe shadow / hazard tape 2). */
  accent2: number;
}

/** Per-level-style palettes (see {@link LevelStyle}). */
export const STYLE_COLORS: Record<LevelStyle, StyleColorSet> = {
  // Level 0 "The Lobby" — sickly, mildewed office wallpaper over a seamless,
  // slightly damp Berber carpet. Wiki: "closer to a brownish beige when
  // viewed in isolation" rather than pure yellow.
  lobby: {
    seed: 401,
    floor: 0xac9a5c,
    floorWeaveHi: 0xc2ad70,
    floorWeaveLo: 0x8a7a44,
    floorStain: 0x5c5230,
    wall: 0xcabb78,
    wallStripe: 0xb9aa66,
    wallStripeGap: 7,
    wallHi: 0xe4d69e,
    wallHi2: 0xdacb8c,
    wallShade: 0x9c8a52,
    wallShade2: 0xb0a066,
    wallDark: 0x6f602f,
    wallSpeckleHi: 0xe8dcae,
    wallSpeckleLo: 0x5f5a30,
    wallPattern: "wallpaper",
    floorPattern: "weave",
    accent: 0xb9aa66,
    accent2: 0x6f602f,
  },
  // Level 1 "The Habitable Zone" — a massive warehouse of bare concrete
  // floors and walls with exposed rebar and dim fluorescent light. Also the
  // base industrial palette every deeper level derives from.
  habitable: {
    seed: 811,
    floor: 0x8c8f92,
    floorWeaveHi: 0x9fa2a5,
    floorWeaveLo: 0x6f7274,
    floorStain: 0x3f4244,
    wall: 0x9a9c9e,
    wallStripe: 0x86888a,
    wallStripeGap: 11,
    wallHi: 0xc4c6c8,
    wallHi2: 0xb4b6b8,
    wallShade: 0x707274,
    wallShade2: 0x84868a,
    wallDark: 0x505254,
    wallSpeckleHi: 0xd0d2d4,
    wallSpeckleLo: 0x45474a,
    wallPattern: "concrete",
    floorPattern: "concrete",
    accent: 0x86888a,
    accent2: 0x505254,
  },
  // Level 2 "Pipe Dreams" — a dim, decrepit maintenance tunnel: grimy dark
  // concrete, mould speckle, and rusted pipes lining the walls.
  pipedreams: {
    seed: 1201,
    floor: 0x4a4438,
    floorWeaveHi: 0x5c5646,
    floorWeaveLo: 0x322e22,
    floorStain: 0x1c1a12,
    wall: 0x565045,
    wallStripe: 0x494336,
    wallStripeGap: 9,
    wallHi: 0x7a7260,
    wallHi2: 0x6c6552,
    wallShade: 0x3a362a,
    wallShade2: 0x494336,
    wallDark: 0x252017,
    wallSpeckleHi: 0x8a8268,
    wallSpeckleLo: 0x1f1c12,
    wallPattern: "pipes",
    floorPattern: "concrete",
    accent: 0xac5a2e,
    accent2: 0x6b3f22,
  },
  // Level 3 "Poolrooms" — pristine, seamless white ceramic tile throughout,
  // with a faint blue-green tinge from the standing water.
  poolrooms: {
    seed: 2301,
    floor: 0xe4ecec,
    floorWeaveHi: 0xf2f8f8,
    floorWeaveLo: 0xc7d6d6,
    floorStain: 0x9fc4c2,
    wall: 0xe8f0ef,
    wallStripe: 0xcfe0df,
    wallStripeGap: 8,
    wallHi: 0xffffff,
    wallHi2: 0xf4fafa,
    wallShade: 0xb9cccb,
    wallShade2: 0xd2e2e1,
    wallDark: 0x8fa8a6,
    wallSpeckleHi: 0xffffff,
    wallSpeckleLo: 0xcfe0df,
    wallPattern: "tile",
    floorPattern: "tile",
    accent: 0x6fd0c8,
    accent2: 0x2c8f8a,
  },
  // Level 4 "Run For Your Life" — the final, most dangerous stretch: scorched
  // concrete and hazard tape rather than a documented wiki area.
  hazard: {
    seed: 3401,
    floor: 0x3a2620,
    floorWeaveHi: 0x4c332a,
    floorWeaveLo: 0x241813,
    floorStain: 0x140d0a,
    wall: 0x4a3228,
    wallStripe: 0x38261e,
    wallStripeGap: 9,
    wallHi: 0x6e4c3c,
    wallHi2: 0x5f4234,
    wallShade: 0x2a1c16,
    wallShade2: 0x38261e,
    wallDark: 0x180f0b,
    wallSpeckleHi: 0x7a5a44,
    wallSpeckleLo: 0x140c09,
    wallPattern: "hazard",
    floorPattern: "concrete",
    accent: 0xe0a838,
    accent2: 0x1a1410,
  },
} as const;

export const COLORS = {
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
  // Debris scattered by the exit breach — neutral, independent of level style.
  rubbleShade: 0x726a5c,
  rubbleDark: 0x433d33,
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
  /** Baked per-style, per-neighbour-mask wall slab (see {@link WALL_MASK}). */
  wall: (style: LevelStyle, mask: number) => `tex-wall-${style}-${mask}`,
  wallCrack: (style: LevelStyle) => `tex-wall-crack-${style}`,
  floor: (style: LevelStyle) => `tex-floor-${style}`,
  exit: (style: LevelStyle) => `tex-exit-${style}`,
  player: "tex-player",
  playerWalk: "tex-player-walk",
  playerBack: "tex-player-back",
  playerBackWalk: "tex-player-back-walk",
  monster: "tex-monster",
  monsterWalk: "tex-monster-walk",
  monsterBack: "tex-monster-back",
  monsterBackWalk: "tex-monster-back-walk",
  hole: "tex-hole",
  rubble: "tex-rubble",
} as const;

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
