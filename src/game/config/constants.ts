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
  size: 40,
  bodyInset: 10,
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
 * On non-lethal difficulties a Pursuit-phase catch must never just leave the
 * monster glued to the player (worst case, permanently pinning them in a dead
 * end with nothing else able to happen). Instead it scares and shoves off.
 */
export const PURSUIT_CATCH = {
  /** How far the monster is knocked back from the player on a non-lethal
   *  catch — comfortably past killRadius so it doesn't re-trigger next frame. */
  knockbackDistance: 140,
  /** How long the monster holds still after the shove before resuming the
   *  chase — the real gate against an instant re-catch loop. */
  stunMs: 2200,
  /** Minimum time between non-lethal catch reactions (ms). Kept >= stunMs so
   *  the monster is never chasing again before it's allowed to react again. */
  cooldownMs: 2200,
  /** After this many non-lethal catches in one run, the pursuer gives up for
   *  good instead of looping forever — the chase should read as scary, not
   *  as an unending punishment. */
  maxCatches: 3,
} as const;

/** How often (ms) each pursuing monster recalculates its route to the player
 *  through the maze. See ai/pathfinding.ts. */
export const PATHFIND = {
  recalcMs: 400,
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
  minIntervalMs: 5500,
  maxIntervalMs: 12500,
  minVisibleMs: 1500,
  maxVisibleMs: 2900,
  /** World-unit distance at which an above-easy encounter attacks. */
  attackRadius: 68,
  /** Tile-distance band from the player it can appear within — close enough
   *  to be seen, far enough to feel like it was already there. */
  spawnMinRadiusTiles: 2.5,
  spawnMaxRadiusTiles: 5,
  /** Fraction of encounters that are a silent "peek" — a silhouette that
   *  never approaches or attacks, just proves it was watching. Unsettling
   *  precisely because nothing happens. */
  peekChance: 0.45,
  /** Peek encounters vanish faster — it's gone the moment you notice it. */
  peekVisibleMs: 900,
} as const;

/** Ambient environmental "process" pacing — flickers/whispers/thuds/screams
 *  that are pure atmosphere, independent of the monster director. Tightened
 *  interval keeps something creepy happening almost constantly. */
export const ANOMALY = {
  minIntervalMs: 5000,
  maxIntervalMs: 10000,
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

/**
 * The Stalker: a "don't look away" horror mechanic (see StalkerAI). It's a
 * single persistent entity, independent of the level's patrol monsters, only
 * active during the Ambient phase.
 */
export const STALKER = {
  /** World distance at which a lurking stalker arms and starts creeping. */
  triggerRadius: 340,
  /** World distance at which an unseen stalker lunges. */
  grabRadius: 30,
  /** Creep speed (world units/sec) — slower than the player's walk, so
   *  outrunning it is trivial; the threat is never looking away, not speed. */
  creepSpeed: 46,
  /** World-unit offset it snaps to from the player when it lunges — right in
   *  their face, but not overlapping the sprite. */
  lungeOffset: 16,
  /** Seconds the lunge scare beat holds before it retreats. */
  lungeDuration: 0.6,
  /** Seconds off-stage after a lunge before it can lurk again. */
  retreatCooldown: 9,
  /** Tile-distance band from the player it respawns within after retreating. */
  respawnMinRadiusTiles: 9,
  respawnMaxRadiusTiles: 16,
  /** How much further than the fog reveal radius the player can *just* spot
   *  it at the edge of the dark — a hair short of comfortable. */
  visRadiusBonusTiles: 1,
} as const;

/**
 * Dynamic tension: a 0..1 "fear" value derived each frame from the nearest
 * threat, driving the heartbeat cue and the screen vignette so dread reads
 * physically, not just as an audio cue.
 */
export const FEAR = {
  heartbeatMinIntervalMs: 340,
  heartbeatMaxIntervalMs: 1150,
  vignetteMinStrength: 0.16,
  // Capped short of "screen goes black" — at max fear the play area must
  // stay readable enough to navigate a chase to the exit.
  vignetteMaxStrength: 0.7,
  vignetteMaxRadius: 0.85,
  vignetteMinRadius: 0.42,
  // Width of the darken gradient band (normalized, aspect-corrected) — wide
  // enough that the edge reads as a soft fade, never a hard ring.
  vignetteFeather: 0.4,
} as const;

/** Random ambient power-flicker beat: the lights gutter and the fog swallows
 *  the room for a moment — pure atmosphere, no monster required. */
export const BLACKOUT_EVENT = {
  minIntervalMs: 10000,
  maxIntervalMs: 18000,
  durationMs: 320,
} as const;

/** Permanent flat dim over the whole screen, independent of fog/vignette —
 *  so even fully "Visible" tiles read as dim sickly fluorescent light
 *  instead of a fully-lit set. Applied everywhere, all the time. */
export const AMBIENT_DARKEN = {
  alpha: 0.22,
} as const;

/** Retro CRT/VHS dressing — a permanent low-key scanline + grain overlay,
 *  plus the glitch strobe kicked off by the "static" ambient anomaly. Pure
 *  cosmetic texture; never affects gameplay or readability. */
export const OLDSCHOOL_FX = {
  scanlineAlpha: 0.16,
  grainAlpha: 0.05,
  /** How often the grain noise resamples to a new offset (ms) — a cheap
   *  flicker instead of animating every frame. */
  grainJitterMs: 70,
  /** Duration of the camera+overlay glitch strobe from a "static" anomaly. */
  glitchMs: 220,
} as const;

/** Never generate more monsters than this, whatever the difficulty/index. */
export const MAX_MONSTERS = 8;

/**
 * The Flashlight: a single rare pickup, findable only in the first level
 * (see MainScene.buildFlashlightPickup) and kept for the rest of the game
 * session once found. Equip/use it from hotbar slot 1; it aims a beam at the
 * cursor that widens the fog-of-war reveal in that direction.
 */
export const FLASHLIGHT = {
  /** World-unit pickup radius for the F interact prompt. */
  pickupRadius: 26,
  /** Half-angle of the light cone, in radians. */
  coneHalfAngleRad: (26 * Math.PI) / 180,
  /** How far (in tiles) the beam reveals. */
  coneRadiusTiles: 13,
  /** Throttle (ms) between recomputing the beam's revealed tiles. */
  recalcMs: 70,
} as const;

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
export type WallPattern =
  "wallpaper" | "concrete" | "pipes" | "tile" | "hazard";
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
  /** Colour a monster's neutral tint is subtly blended toward on this level —
   *  same silhouette everywhere, but each level's threat feels faintly "of
   *  the place" it lurks in. */
  monsterMood: number;
}

/** How many baked variants exist per wall (style, mask) and per floor style —
 *  variant 0 is always the clean baseline; the rest layer in extra grime and
 *  one deliberately unsettling detail (see {@link PreloadScene}) so a level
 *  doesn't read as one texture stamped everywhere. */
export const WALL_VARIANTS = 3;
export const FLOOR_VARIANTS = 3;

/** Small scattered set-dressing props, two per style — pure decoration
 *  (no collider), placed sparsely across floor tiles. */
export type PropKind =
  | "chair"
  | "boxes"
  | "crate"
  | "barrel"
  | "valve"
  | "pipecart"
  | "drain"
  | "crack"
  | "sign"
  | "scorchpile";

export const STYLE_PROPS: Record<LevelStyle, readonly [PropKind, PropKind]> = {
  lobby: ["chair", "boxes"],
  habitable: ["crate", "barrel"],
  pipedreams: ["valve", "pipecart"],
  poolrooms: ["drain", "crack"],
  hazard: ["sign", "scorchpile"],
};

/** Tuning for ambient decoration/collectible scatter — see MainScene's
 *  hash-based placement pass. */
export const DECORATION = {
  /** Fraction of eligible floor tiles that get a prop (~1 in 90). */
  propChance: 1 / 90,
  /** Fraction of eligible floor tiles that get an Almond Water pickup. */
  almondChance: 1 / 260,
  /** Hard cap on Almond Water pickups per level, however large the map. */
  almondMaxPerLevel: 6,
  /** Extra reveal-radius tiles granted for a sip of Almond Water. */
  almondVisionBoostTiles: 2.5,
  /** How long the vision boost lasts (ms). */
  almondVisionBoostMs: 9000,
  /** World-unit pickup radius. */
  almondPickupRadius: 14,
} as const;

/**
 * Found documents (letters/book pages) scattered per level — see
 * game/content/lore.ts for the actual text and MainScene's
 * buildLorePickups/updateLorePickups for placement + the [F] read prompt.
 */
export const LORE_PICKUP = {
  /** Fewest documents placed on a level, never more than its authored pool. */
  minPerLevel: 3,
  /** Most documents placed on a level, capped by its authored pool size. */
  maxPerLevel: 5,
  /** World-unit pickup radius for the [F] read prompt. */
  pickupRadius: 24,
  /** Squared tile-distance from spawn a document must be placed beyond, so
   *  none spawn directly underfoot at level start (same idea as the
   *  Flashlight's "tucked away" spawn check). */
  minSpawnDistSqTiles: 9,
} as const;

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
    monsterMood: 0xfff0c0,
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
    monsterMood: 0xd8dde0,
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
    monsterMood: 0xe0a878,
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
    monsterMood: 0xd0f0ec,
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
    monsterMood: 0xffb078,
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
  // Lurking monster — pale, gaunt, bald-skulled thing
  monsterBody: 0xc9bb8c,
  monsterBodyHi: 0xe0d4a6,
  monsterBodyShade: 0x8f8362,
  monsterLimb: 0xaea070,
  monsterEye: 0x0b0906,
  monsterEyeGlow: 0x2a2419,
  monsterMaw: 0xe8e0c8,
  monsterMawShade: 0x1c1712,
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
  // Exposed structural rebar, poking through a chipped concrete wall.
  rebarRust: 0xa8552e,
  // Generic set-dressing prop materials, independent of level style.
  propWood: 0x7a5636,
  propWoodDark: 0x4d3520,
  propMetal: 0x8a8d90,
  propMetalDark: 0x54575a,
  propCardboard: 0xc2a06a,
  propCardboardDark: 0x8c7148,
  propSignBg: 0xe8c22a,
  propSignDark: 0x1a1410,
  // Almond Water pickup — the Backrooms survival staple.
  almondGlass: 0x8fae62,
  almondGlassHi: 0xbcd68f,
  almondLiquid: 0xd8c98a,
  almondLabel: 0xf4ecd2,
  almondGlow: 0xeaffb0,
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
  /** Baked per-style, per-neighbour-mask, per-variant wall slab (see
   *  {@link WALL_MASK}, {@link WALL_VARIANTS}). */
  wall: (style: LevelStyle, mask: number, variant: number) =>
    `tex-wall-${style}-${mask}-${variant}`,
  wallCrack: (style: LevelStyle) => `tex-wall-crack-${style}`,
  floor: (style: LevelStyle, variant: number) =>
    `tex-floor-${style}-${variant}`,
  exit: (style: LevelStyle) => `tex-exit-${style}`,
  prop: (kind: PropKind) => `tex-prop-${kind}`,
  almondWater: "tex-almond-water",
  flashlight: "tex-flashlight-item",
  loreLetter: "tex-lore-letter",
  loreBook: "tex-lore-book",
  monster: "tex-monster",
  monsterWalk: "tex-monster-walk",
  monsterBack: "tex-monster-back",
  monsterBackWalk: "tex-monster-back-walk",
  hole: "tex-hole",
  rubble: "tex-rubble",
  scanlines: "tex-scanlines",
  grain: "tex-grain",
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
  stalker: 0xd8d0e8, // bone-pale, almost still-life — the "don't look away" thing
} as const;

/**
 * Ambient patrol monsters (see MainScene.updateMonsterFogVisibility) read as
 * glimpses in the dark, not a crowd standing in the open: only ever the one
 * nearest the player is drawn, faded toward the fog rim same as the tiles,
 * and capped below full opacity even point-blank — applies on every level,
 * not just Level 0.
 */
export const MONSTER_STEALTH = {
  /** Sprite alpha cap even at point-blank range. */
  maxAlpha: 0.88,
  /** Sprite alpha floor just before it fades out at the sight radius' rim. */
  minAlpha: 0.12,
} as const;

export const SCENES = {
  boot: "BootScene",
  preload: "PreloadScene",
  main: "MainScene",
} as const;

export const VISIBILITY = {
  revealRadiusTiles: 6,
  losStepTiles: 0.25,
  dimAlpha: 0.58,
  /** How long a tile's fog fades between states — the "cleaner" smooth reveal
   *  instead of an instant pop. */
  fadeMs: 260,
  /** Width (in tiles) of the soft vignette band at the edge of the reveal
   *  radius, so the sight radius reads as a gentle falloff, not a hard disc. */
  edgeFalloffTiles: 1.6,
} as const;
