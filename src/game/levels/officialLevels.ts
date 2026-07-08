import type { LevelStyle } from "@/game/config/constants";

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
  /** Which baked asset set (wallpaper lobby vs bare-concrete warehouse) this
   *  level's tiles are drawn from — see {@link LevelStyle}. */
  style: LevelStyle;
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
      "keep your light low, because something out there loves it too much. " +
      "Find the flickering wall and throw yourself into Level 1.",
    theme: { tint: 0xffffff, fog: 0x05050a, style: "lobby" },
  },
  {
    index: 1,
    id: "level-1",
    name: "Level 1 — Habitable Zone",
    blurb:
      "A warehouse of bare concrete and exposed rebar — the old camps are " +
      "half-friendly, but not everything upright in here is glad to see you. " +
      "Keep quiet, and don't stare back at whatever stares first.",
    theme: { tint: 0xffffff, fog: 0x080a0d, style: "habitable" },
  },
  {
    index: 2,
    id: "level-2",
    name: "Level 2 — Pipe Dreams",
    blurb:
      "Rusted pipes line a scalding maintenance tunnel — total dark, and the " +
      "mould smell never leaves. Keep the light low; something out here is " +
      "drawn to it, and it isn't alone in the dark.",
    theme: { tint: 0xffffff, fog: 0x05100c, style: "pipedreams" },
  },
  {
    index: 3,
    id: "level-3",
    name: "Level 3 — Poolrooms",
    blurb:
      "Warm, waist-deep water and endless pristine white tile. No exit in " +
      "sight — and on a still day, you can almost convince yourself you're " +
      "alone in it too.",
    theme: { tint: 0xffffff, fog: 0x061014, style: "poolrooms" },
  },
  {
    index: 4,
    id: "level-4",
    name: "Level 4 — Run For Your Life",
    blurb: "Scorched concrete and hazard tape. It knows you are here. Do not stop.",
    theme: { tint: 0xffffff, fog: 0x0c0604, style: "hazard" },
  },
  {
    index: 5,
    id: "level-5",
    name: "Level 5 — The Terror Hotel",
    blurb:
      "Mahogany panelling, wine-red carpet, and a front desk nobody staffs. " +
      "The guests in period dress have no faces, and somewhere below, a " +
      "party has been going on far, far too long. Do not accept the invite.",
    theme: { tint: 0xffffff, fog: 0x0a0506, style: "hotel" },
  },
  {
    index: 6,
    id: "level-6",
    name: "Level 6 — Lights Out",
    blurb:
      "Riveted steel and cable runs in the kind of dark that eats a torch " +
      "beam whole. You'll hear the grin before you see it — and by then " +
      "it has already seen you. Keep a wall at your back and move.",
    theme: { tint: 0xffffff, fog: 0x020204, style: "lightsout" },
  },
];

export const LAST_LEVEL_INDEX = OFFICIAL_LEVELS.length - 1;

export function getOfficialLevel(index: number): OfficialLevel {
  const clamped = Math.max(0, Math.min(LAST_LEVEL_INDEX, index));
  return OFFICIAL_LEVELS[clamped]!;
}
