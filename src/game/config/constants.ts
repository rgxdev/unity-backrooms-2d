export const TILE_SIZE = 32;

export const PLAYER = {
  size: 14,
  speed: 140,
  bodyInset: 2,
} as const;

export const COLORS = {
  floor: 0xbfae54,
  floorAlt: 0xb2a24c,
  wall: 0x6f6330,
  wallShade: 0x554b24,
  player: 0xe8e2c4,
  playerOutline: 0x1a180f,
  fog: 0x05050a,
} as const;

export const TEXTURES = {
  floor: "tex-floor",
  floorAlt: "tex-floor-alt",
  wall: "tex-wall",
  player: "tex-player",
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
