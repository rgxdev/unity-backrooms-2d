/**
 * The official Backrooms levels the player progresses through. Each level keeps
 * a stable identity (number, name, colour theme) while its actual layout is
 * generated fresh each play. Beating one unlocks the next.
 */
export interface LevelTheme {
  /** Multiplicative tint applied to floor/wall/exit tiles (0xffffff = none). */
  tint: number;
  /** Fog / background colour. */
  fog: number;
}

export interface OfficialLevel {
  index: number;
  id: string;
  name: string;
  blurb: string;
  theme: LevelTheme;
}

export const OFFICIAL_LEVELS: readonly OfficialLevel[] = [
  {
    index: 0,
    id: "level-0",
    name: "Level 0 — The Lobby",
    blurb:
      "Mono-yellow rooms: pillar halls, pitch-black pits, sticky red rooms — " +
      "find the flickering wall and throw yourself into Level 1.",
    theme: { tint: 0xffffff, fog: 0x05050a },
  },
  {
    index: 1,
    id: "level-1",
    name: "Level 1 — Habitable Zone",
    blurb: "Damp concrete corridors. Something else walks here too.",
    theme: { tint: 0xb8bec6, fog: 0x080a0d },
  },
  {
    index: 2,
    id: "level-2",
    name: "Level 2 — Pipe Dreams",
    blurb: "Miles of pipework, hissing steam and total dark.",
    theme: { tint: 0x8fb2a1, fog: 0x05100c },
  },
  {
    index: 3,
    id: "level-3",
    name: "Level 3 — Poolrooms",
    blurb: "Warm water, tiled halls, no exit in sight.",
    theme: { tint: 0x9fd0e0, fog: 0x061014 },
  },
  {
    index: 4,
    id: "level-4",
    name: "Level 4 — Run For Your Life",
    blurb: "It knows you are here. Do not stop.",
    theme: { tint: 0xd08a6a, fog: 0x0c0604 },
  },
];

export const LAST_LEVEL_INDEX = OFFICIAL_LEVELS.length - 1;

export function getOfficialLevel(index: number): OfficialLevel {
  const clamped = Math.max(0, Math.min(LAST_LEVEL_INDEX, index));
  return OFFICIAL_LEVELS[clamped]!;
}
