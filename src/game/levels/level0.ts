import { parseLevel, TileKind, type LevelData } from "@/lib/schemas/level";
import { DIFFICULTY_CONFIG, MAX_MONSTERS } from "@/game/config/constants";
import { chance, makeRng, pick, randInt, shuffle, type Rng } from "./rng";
import type { GenerateInput } from "./generate";
import { pickWallExit } from "./wallExit";

/**
 * Level 0 — "The Lobby" — themed after the Backrooms wiki entry
 * (https://backrooms-wiki.wikidot.com/level-0): the endless mono-yellow maze
 * of documented sub-sections, each with its own hazard:
 *
 *   Arch Variation   — pale walls with archway pillars; the calm starting room.
 *   Pillar Variation — a miles-wide grid of pillars you weave between.
 *   Hole Variation   — a field of bottomless pits; one wrong step and you fall.
 *   Blackout Zone    — unlit section that never fully lights up.
 *   Red Room         — sticky crimson loop that is hard to leave; a thing lurks.
 *   Manila Room      — a rare, calm safe room tucked beside the way out.
 *
 * The only way out is the same as the lore: survive to the far side and find
 * the flickering wall to throw yourself through — that becomes the next
 * level's entry.
 *
 * The world is a grid of sectors, but — unlike a hand-placed layout — *which*
 * sector gets which hazard is rolled fresh every generation (see
 * {@link buildLayout}), so no two plays share the same floor plan. Spawn
 * always lands in an Arch corner and the exit in the Manila corner farthest
 * from it (so the run always has real length); the remaining hazards are
 * shuffled across the rest of the grid. Doorways are carved *after* hazards
 * are painted in, so every sector-to-sector doorway forcibly floors its own
 * path — a hole-free route from spawn to exit always exists no matter where
 * the Hole Variation lands.
 */

const COLS = 3;
const ROWS = 2;

type Variation = "arch" | "pillar" | "hole" | "blackout" | "red" | "manila";

interface Cell {
  r: number;
  c: number;
}

/** Every hazard variation appears exactly once outside the spawn/exit corners. */
const HAZARD_POOL: readonly Variation[] = ["pillar", "hole", "blackout", "red"];

/**
 * Roll a fresh sector layout: spawn (Arch) and exit (Manila) anchor two
 * corners of the grid — picked so they're the farthest apart, guaranteeing a
 * long traversal — and the remaining hazards are shuffled across whatever
 * cells are left.
 */
function buildLayout(rng: Rng): { layout: Variation[][]; spawnCell: Cell; exitCell: Cell } {
  const cells: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) cells.push({ r, c });
  }
  const corners: Cell[] = [
    { r: 0, c: 0 },
    { r: 0, c: COLS - 1 },
    { r: ROWS - 1, c: 0 },
    { r: ROWS - 1, c: COLS - 1 },
  ];
  const manhattan = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

  const spawnCell = pick(rng, corners);
  const maxDist = Math.max(...corners.map((c) => manhattan(c, spawnCell)));
  const farCorners = corners.filter(
    (c) => c !== spawnCell && manhattan(c, spawnCell) === maxDist,
  );
  const exitCell = pick(rng, farCorners);

  const layout: Variation[][] = Array.from({ length: ROWS }, () =>
    Array<Variation>(COLS).fill("pillar"),
  );
  layout[spawnCell.r]![spawnCell.c] = "arch";
  layout[exitCell.r]![exitCell.c] = "manila";

  const remaining = cells.filter(
    (cell) =>
      !(cell.r === spawnCell.r && cell.c === spawnCell.c) &&
      !(cell.r === exitCell.r && cell.c === exitCell.c),
  );
  // Exactly one of each hazard when remaining.length === HAZARD_POOL.length
  // (true for the default 3×2 grid); cycle the pool for any larger grid.
  const pool = shuffle(
    rng,
    remaining.map((_, i) => HAZARD_POOL[i % HAZARD_POOL.length]!),
  );
  shuffle(rng, remaining).forEach((cell, i) => {
    layout[cell.r]![cell.c] = pool[i]!;
  });

  return { layout, spawnCell, exitCell };
}

function findCell(layout: Variation[][], variation: Variation): Cell {
  for (let r = 0; r < layout.length; r++) {
    const c = layout[r]!.indexOf(variation);
    if (c >= 0) return { r, c };
  }
  throw new Error(`layout has no "${variation}" cell`);
}

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

/** Regular grid of single-tile pillars — the "miles of pillars" look. Spacing
 *  jitters 3-4 tiles per generation so the grid doesn't look stamped. */
function addPillars(tiles: number[], width: number, r: Room, rng: Rng): void {
  const spacing = randInt(rng, 3, 4);
  for (let y = r.y + 2; y < r.y + r.h - 1; y += spacing) {
    for (let x = r.x + 2; x < r.x + r.w - 1; x += spacing) {
      tiles[y * width + x] = TileKind.Wall;
    }
  }
}

/** Grid of bottomless pits with 1-tile safe lanes woven between them. The
 *  parity offset shifts per generation so the safe lane doesn't always fall
 *  on the same rows/columns. */
function addHoles(tiles: number[], width: number, r: Room, rng: Rng): void {
  const phaseX = randInt(rng, 0, 1);
  const phaseY = randInt(rng, 0, 1);
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (x % 2 === phaseX && y % 2 === phaseY) {
        tiles[y * width + x] = TileKind.Hole;
      }
    }
  }
}

/** A near-closed loop: a solid core leaves only a ring corridor around it.
 *  Ring width jitters 2-3 tiles for variety. */
function addRedLoop(tiles: number[], width: number, r: Room, rng: Rng): void {
  const ring = randInt(rng, 2, 3);
  const cx = r.x + ring;
  const cy = r.y + ring;
  const cw = r.w - ring * 2;
  const ch = r.h - ring * 2;
  if (cw <= 0 || ch <= 0) return;
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

  // Roll a fresh sector layout every generation — spawn/exit anchor two
  // farthest-apart corners, the rest of the hazards are shuffled.
  const { layout, spawnCell, exitCell } = buildLayout(rng);

  // Apply each sector's hazard.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const room = rooms[r]![c]!;
      switch (layout[r]![c]!) {
        case "arch":
          addArches(tiles, width, room, rng);
          break;
        case "pillar":
          addPillars(tiles, width, room, rng);
          break;
        case "hole":
          addHoles(tiles, width, room, rng);
          break;
        case "red":
          addRedLoop(tiles, width, room, rng);
          break;
        // blackout + manila carry no wall hazard — just theming.
      }
    }
  }

  // Doorways: connect each sector to its right and bottom neighbour so the
  // whole grid is reachable (multiple routes = the shifting-maze feel). Doors
  // are carved *after* hazards, so every doorway forcibly floors its own
  // straight path — a route between any two sectors is always walkable.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = centre(rooms[r]![c]!);
      if (c < COLS - 1) carveDoor(tiles, width, a, centre(rooms[r]![c + 1]!));
      if (r < ROWS - 1) carveDoor(tiles, width, a, centre(rooms[r + 1]![c]!));
    }
  }

  const spawn = centre(rooms[spawnCell.r]![spawnCell.c]!);
  const exitRoom = rooms[exitCell.r]![exitCell.c]!; // manila sector
  // The exit reads as a genuine breach in the wall bank around the room
  // (not a tile floating in the open floor) whenever one can be found.
  const exit = pickWallExit(tiles, width, height, exitRoom, rng) ?? {
    x: exitRoom.x + exitRoom.w - 2,
    y: exitRoom.y + exitRoom.h - 2,
  };

  // A small hidden Manila safe room in the exit sector's corner.
  const manila: Room = {
    x: exitRoom.x + 1,
    y: exitRoom.y + 1,
    w: Math.min(4, exitRoom.w - 2),
    h: Math.min(4, exitRoom.h - 2),
  };
  carveRoom(tiles, width, manila);
  carveDoor(tiles, width, centre(manila), centre(exitRoom));

  // Zones: theming + the hidden Manila room. Rooms are looked up from the
  // rolled layout, not fixed grid positions, since the layout is randomized.
  const redCell = findCell(layout, "red");
  const blackoutCell = findCell(layout, "blackout");
  const pillarCell = findCell(layout, "pillar");
  const redRoom = rooms[redCell.r]![redCell.c]!;
  const blackoutRoom = rooms[blackoutCell.r]![blackoutCell.c]!;
  const fillerRoom = rooms[pillarCell.r]![pillarCell.c]!;
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
    monsters.push(makeMonster(`lurker-${i}`, fillerRoom));
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
