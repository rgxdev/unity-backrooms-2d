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
  fog: 0x05050a,
} as const;

export const TEXTURES = {
  floor: "tex-floor",
  floorAlt: "tex-floor-alt",
  wall: "tex-wall",
  player: "tex-player",
  monster: "tex-monster",
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
