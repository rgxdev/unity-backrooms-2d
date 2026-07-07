import { parseLevel, TileKind, type LevelData } from "@/lib/schemas/level";
import { DIFFICULTY_CONFIG, MAX_MONSTERS } from "@/game/config/constants";
import { chance, makeRng, type Rng } from "./rng";
import type { GenerateInput } from "./generate";

/**
 * Level 0 — "The Lobby" — hand-authored to match the Backrooms wiki entry
 * (https://backrooms-wiki.wikidot.com/level-0). Instead of the generic room
 * generator, this lays the endless mono-yellow maze out as the documented
 * sub-sections, each with its own hazard:
 *
 *   Arch Variation   — pale walls with archway pillars; the calm starting room.
 *   Pillar Variation — a miles-wide grid of pillars you weave between.
 *   Hole Variation   — a field of bottomless pits; one wrong step and you fall.
 *   Blackout Zone    — unlit section that never fully lights up.
 *   Red Room         — sticky crimson loop that is hard to leave; a thing lurks.
 *   Manila Room      — a rare, calm safe room tucked beside the way out.
 *
 * The only way out is the same as the lore: survive to the far side and find
 * the flickering wall to throw yourself through — that becomes Level 1's entry.
 *
 * The world is a 3×2 grid of sectors. Adjacent sectors are joined by doorways
 * so the whole floor is connected, and a hole-free route to the exit always
 * exists (top row + right column never contains pits).
 */

const COLS = 3;
const ROWS = 2;

type Variation = "arch" | "pillar" | "hole" | "blackout" | "red" | "manila";

// Sector layout (col-major within each row). Spawn is the arch room (0,0),
// the exit + Manila room sit in the far sector (2,1). Holes are quarantined to
// the interior sector (1,1) so a pit-free path around the edge always exists.
const LAYOUT: Variation[][] = [
  ["arch", "pillar", "blackout"],
  ["red", "hole", "manila"],
];

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function centre(r: Room): { x: number; y: number } {
  return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
}

function carveRoom(tiles: number[], width: number, r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[y * width + x] = TileKind.Floor;
    }
  }
}

/** Straight 2-wide floor run between two points (they always share an axis). */
function carveDoor(
  tiles: number[],
  width: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): void {
  if (a.y === b.y) {
    const [lo, hi] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    for (let x = lo; x <= hi; x++) {
      tiles[a.y * width + x] = TileKind.Floor;
      tiles[(a.y + 1) * width + x] = TileKind.Floor;
    }
  } else {
    const [lo, hi] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
    for (let y = lo; y <= hi; y++) {
      tiles[y * width + a.x] = TileKind.Floor;
      tiles[y * width + a.x + 1] = TileKind.Floor;
    }
  }
}

/** Colonnade of paired pillars leaving walkable archways between them. */
function addArches(tiles: number[], width: number, r: Room, rng: Rng): void {
  for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) {
    for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) {
      if (chance(rng, 0.85)) tiles[y * width + x] = TileKind.Wall;
    }
  }
}

/** Regular grid of single-tile pillars — the "miles of pillars" look. */
function addPillars(tiles: number[], width: number, r: Room): void {
  for (let y = r.y + 2; y < r.y + r.h - 1; y += 3) {
    for (let x = r.x + 2; x < r.x + r.w - 1; x += 3) {
      tiles[y * width + x] = TileKind.Wall;
    }
  }
}

/** Grid of bottomless pits with 1-tile safe lanes woven between them. */
function addHoles(tiles: number[], width: number, r: Room): void {
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      // Pit on even/even cells; the odd rows/cols stay as safe lanes.
      if (x % 2 === 0 && y % 2 === 0) tiles[y * width + x] = TileKind.Hole;
    }
  }
}

/** A near-closed loop: a solid core leaves only a ring corridor around it. */
function addRedLoop(tiles: number[], width: number, r: Room): void {
  const cx = r.x + 2;
  const cy = r.y + 2;
  const cw = r.w - 4;
  const ch = r.h - 4;
  for (let y = cy; y < cy + ch; y++) {
    for (let x = cx; x < cx + cw; x++) {
      tiles[y * width + x] = TileKind.Wall;
    }
  }
}

function makeMonster(id: string, room: Room) {
  const inset = 1;
  const c = centre(room);
  return {
    id,
    x: c.x,
    y: c.y,
    patrol: [
      { x: room.x + inset, y: room.y + inset },
      { x: room.x + room.w - 1 - inset, y: room.y + inset },
      { x: room.x + room.w - 1 - inset, y: room.y + room.h - 1 - inset },
      { x: room.x + inset, y: room.y + room.h - 1 - inset },
    ],
  };
}

export function generateLevel0(input: GenerateInput): LevelData {
  const cfg = DIFFICULTY_CONFIG[input.difficulty];
  const rng = makeRng(input.seed >>> 0);

  // Level 0 is deliberately large so every sub-section has room to breathe.
  // Harder difficulties widen it further.
  const width = clamp(51 + (cfg.base.width - 34), 45, 150);
  const height = clamp(42 + (cfg.base.height - 26), 36, 150);

  const tiles = new Array<number>(width * height).fill(TileKind.Wall);

  const iw = width - 2;
  const ih = height - 2;
  const sw = Math.floor(iw / COLS);
  const sh = Math.floor(ih / ROWS);

  // Carve each sector as a room inside its grid cell (1-tile wall dividers
  // between cells become doorways later).
  const rooms: Room[][] = [];
  for (let r = 0; r < ROWS; r++) {
    rooms[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cellX = 1 + c * sw;
      const cellY = 1 + r * sh;
      const cellW = c === COLS - 1 ? width - 1 - cellX : sw;
      const cellH = r === ROWS - 1 ? height - 1 - cellY : sh;
      const room: Room = {
        x: cellX + 1,
        y: cellY + 1,
        w: cellW - 2,
        h: cellH - 2,
      };
      rooms[r]![c] = room;
      carveRoom(tiles, width, room);
    }
  }

  // Apply each sector's hazard.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const room = rooms[r]![c]!;
      switch (LAYOUT[r]![c]!) {
        case "arch":
          addArches(tiles, width, room, rng);
          break;
        case "pillar":
          addPillars(tiles, width, room);
          break;
        case "hole":
          addHoles(tiles, width, room);
          break;
        case "red":
          addRedLoop(tiles, width, room);
          break;
        // blackout + manila carry no wall hazard — just theming.
      }
    }
  }

  // Doorways: connect each sector to its right and bottom neighbour so the
  // whole grid is reachable (multiple routes = the shifting-maze feel).
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = centre(rooms[r]![c]!);
      if (c < COLS - 1) carveDoor(tiles, width, a, centre(rooms[r]![c + 1]!));
      if (r < ROWS - 1) carveDoor(tiles, width, a, centre(rooms[r + 1]![c]!));
    }
  }

  const spawn = centre(rooms[0]![0]!);
  const exitRoom = rooms[ROWS - 1]![COLS - 1]!; // manila sector
  const exit = { x: exitRoom.x + exitRoom.w - 2, y: exitRoom.y + exitRoom.h - 2 };

  // A small hidden Manila safe room in the exit sector's corner.
  const manila: Room = {
    x: exitRoom.x + 1,
    y: exitRoom.y + 1,
    w: Math.min(4, exitRoom.w - 2),
    h: Math.min(4, exitRoom.h - 2),
  };
  carveRoom(tiles, width, manila);
  carveDoor(tiles, width, centre(manila), centre(exitRoom));

  // Zones: theming + the hidden Manila room.
  const redRoom = rooms[1]![0]!;
  const blackoutRoom = rooms[0]![2]!;
  const zones = [
    {
      id: "red-room",
      x: redRoom.x,
      y: redRoom.y,
      width: redRoom.w,
      height: redRoom.h,
      hidden: false,
      kind: "red" as const,
    },
    {
      id: "blackout",
      x: blackoutRoom.x,
      y: blackoutRoom.y,
      width: blackoutRoom.w,
      height: blackoutRoom.h,
      hidden: false,
      kind: "blackout" as const,
    },
    {
      id: "manila-room",
      x: manila.x,
      y: manila.y,
      width: manila.w,
      height: manila.h,
      hidden: true,
      kind: "manila" as const,
    },
  ];

  // A thing lurks in the Red Room; a pursuer waits by the exit.
  const monsterCount = clamp(cfg.base.monsters + 1, 1, MAX_MONSTERS);
  const monsters = [makeMonster("pursuer", exitRoom)];
  if (monsterCount > 1) monsters.push(makeMonster("red-lurker", redRoom));
  for (let i = monsters.length; i < monsterCount; i++) {
    monsters.push(makeMonster(`lurker-${i}`, rooms[0]![1]!));
  }

  // Never bury the spawn, exit, monster spawns or their patrol corners under a
  // wall/pillar/hole.
  tiles[spawn.y * width + spawn.x] = TileKind.Floor;
  tiles[exit.y * width + exit.x] = TileKind.Floor;
  for (const m of monsters) {
    tiles[m.y * width + m.x] = TileKind.Floor;
    for (const p of m.patrol) tiles[p.y * width + p.x] = TileKind.Floor;
  }

  return parseLevel({
    id: input.levelId,
    name: input.levelName,
    tileSize: 32,
    width,
    height,
    tiles,
    spawn,
    zones,
    monsters,
    exit,
    pursuitTrigger: {
      x: exitRoom.x,
      y: exitRoom.y,
      width: exitRoom.w,
      height: exitRoom.h,
    },
  });
}
