import { parseLevel, TileKind, type LevelData } from "@/lib/schemas/level";
import type { Difficulty } from "@/lib/schemas/settings";
import { DIFFICULTY_CONFIG, MAX_MONSTERS } from "@/game/config/constants";
import { chance, makeRng, pick, randInt, type Rng } from "./rng";
import { pickWallExit } from "./wallExit";

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GenerateInput {
  levelId: string;
  levelName: string;
  difficulty: Difficulty;
  /** 0-based Backrooms level index — scales size/complexity. */
  levelIndex: number;
  seed: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function roomCentre(r: Room): { x: number; y: number } {
  return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
}

function roomsOverlap(a: Room, b: Room, gap = 1): boolean {
  return (
    a.x - gap < b.x + b.w &&
    a.x + a.w + gap > b.x &&
    a.y - gap < b.y + b.h &&
    a.y + a.h + gap > b.y
  );
}

function carveRoom(tiles: number[], width: number, r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[y * width + x] = TileKind.Floor;
    }
  }
}

/** Carve a horizontal run of floor `thickness` tiles wide, clamped inside the
 *  outer wall. */
function carveH(
  tiles: number[],
  width: number,
  height: number,
  x0: number,
  x1: number,
  y: number,
  thickness: number,
): void {
  const [lo, hi] = x0 < x1 ? [x0, x1] : [x1, x0];
  for (let x = lo; x <= hi; x++) {
    for (let t = 0; t < thickness; t++) {
      const yy = clamp(y + t, 1, height - 2);
      const xx = clamp(x, 1, width - 2);
      tiles[yy * width + xx] = TileKind.Floor;
    }
  }
}

function carveV(
  tiles: number[],
  width: number,
  height: number,
  y0: number,
  y1: number,
  x: number,
  thickness: number,
): void {
  const [lo, hi] = y0 < y1 ? [y0, y1] : [y1, y0];
  for (let y = lo; y <= hi; y++) {
    for (let t = 0; t < thickness; t++) {
      const yy = clamp(y, 1, height - 2);
      const xx = clamp(x + t, 1, width - 2);
      tiles[yy * width + xx] = TileKind.Floor;
    }
  }
}

/**
 * L-shaped corridor between two room centres (random elbow direction).
 * Thickness varies per corridor — mostly the familiar 2-wide hall, sometimes
 * a tight 1-wide tunnel — so a floor doesn't feel like one repeating pattern.
 */
function carveCorridor(
  tiles: number[],
  width: number,
  height: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  rng: Rng,
): void {
  const thickness = chance(rng, 0.7) ? 2 : 1;
  if (chance(rng, 0.5)) {
    carveH(tiles, width, height, a.x, b.x, a.y, thickness);
    carveV(tiles, width, height, a.y, b.y, b.x, thickness);
  } else {
    carveV(tiles, width, height, a.y, b.y, a.x, thickness);
    carveH(tiles, width, height, a.x, b.x, b.y, thickness);
  }
}

/** Sprinkle single-tile pillars deep inside a room for visual complexity. */
function addPillars(
  tiles: number[],
  width: number,
  r: Room,
  rng: Rng,
  count: number,
): void {
  if (r.w < 5 || r.h < 5) return;
  for (let i = 0; i < count; i++) {
    // Margin >= 2 keeps room-edge patrol corners and doorways clear.
    const x = randInt(rng, r.x + 2, r.x + r.w - 3);
    const y = randInt(rng, r.y + 2, r.y + r.h - 3);
    tiles[y * width + x] = TileKind.Wall;
  }
}

function makeMonster(id: string, room: Room) {
  const inset = 1;
  const corners = [
    { x: room.x + inset, y: room.y + inset },
    { x: room.x + room.w - 1 - inset, y: room.y + inset },
    { x: room.x + room.w - 1 - inset, y: room.y + room.h - 1 - inset },
    { x: room.x + inset, y: room.y + room.h - 1 - inset },
  ];
  const c = roomCentre(room);
  return { id, x: c.x, y: c.y, patrol: corners };
}

/**
 * Procedurally generate a Backrooms level: randomly placed rooms joined by
 * random hallways, random interior walls, and a spawn/exit chosen far apart so
 * the run length varies. Size, room count and monster count scale with the
 * difficulty and the level index. Output is validated by the level schema.
 */
export function generateLevel(input: GenerateInput): LevelData {
  const cfg = DIFFICULTY_CONFIG[input.difficulty];
  const rng = makeRng(input.seed >>> 0);

  const width = clamp(
    cfg.base.width + cfg.perLevel.width * input.levelIndex,
    24,
    200,
  );
  const height = clamp(
    cfg.base.height + cfg.perLevel.height * input.levelIndex,
    20,
    200,
  );
  // A little jitter on top of the difficulty/level baseline so consecutive
  // plays of the same level don't all carve the same room count.
  const roomTarget = clamp(
    cfg.base.rooms + cfg.perLevel.rooms * input.levelIndex + randInt(rng, -1, 2),
    3,
    64,
  );
  const monsterCount = clamp(
    cfg.base.monsters + cfg.perLevel.monsters * input.levelIndex,
    1,
    MAX_MONSTERS,
  );
  const extraLinks = cfg.base.extraLinks + input.levelIndex;

  const tiles = new Array<number>(width * height).fill(TileKind.Wall);
  const rooms: Room[] = [];
  const maxRoom = clamp(Math.floor(Math.min(width, height) / 3), 6, 12);

  const attempts = roomTarget * 8;
  for (let a = 0; a < attempts && rooms.length < roomTarget; a++) {
    const w = randInt(rng, 4, maxRoom);
    const h = randInt(rng, 4, maxRoom);
    const x = randInt(rng, 1, width - w - 1);
    const y = randInt(rng, 1, height - h - 1);
    const room: Room = { x, y, w, h };
    if (rooms.some((r) => roomsOverlap(r, room))) continue;
    rooms.push(room);
    carveRoom(tiles, width, room);
  }

  // Guarantee at least two rooms so there is always a spawn and an exit.
  if (rooms.length < 2) {
    rooms.length = 0;
    const a: Room = { x: 1, y: 1, w: 5, h: 5 };
    const b: Room = { x: width - 7, y: height - 7, w: 5, h: 5 };
    rooms.push(a, b);
    carveRoom(tiles, width, a);
    carveRoom(tiles, width, b);
  }

  // Spanning path — connect each room to the previous so every room is
  // reachable. Extra random links add loops (complexity) on top.
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(
      tiles,
      width,
      height,
      roomCentre(rooms[i - 1]!),
      roomCentre(rooms[i]!),
      rng,
    );
  }
  for (let k = 0; k < extraLinks && rooms.length > 2; k++) {
    const a = pick(rng, rooms);
    const b = pick(rng, rooms);
    if (a !== b) {
      carveCorridor(tiles, width, height, roomCentre(a), roomCentre(b), rng);
    }
  }

  // Spawn in the first room; exit in the room farthest from it (longest run).
  const spawnRoom = rooms[0]!;
  const spawn = roomCentre(spawnRoom);
  let exitRoom = rooms[1]!;
  let bestDist = -1;
  for (let i = 1; i < rooms.length; i++) {
    const c = roomCentre(rooms[i]!);
    const d = (c.x - spawn.x) ** 2 + (c.y - spawn.y) ** 2;
    if (d > bestDist) {
      bestDist = d;
      exitRoom = rooms[i]!;
    }
  }
  // The exit reads as a genuine breach in the wall bank around the room
  // (not a tile floating in the open floor) whenever one can be found.
  const exit =
    pickWallExit(tiles, width, height, exitRoom, rng) ?? roomCentre(exitRoom);

  // Interior pillars (skip the spawn room so the start stays open).
  const pillarBudget = input.difficulty === "easy" ? 2 : 3;
  for (const r of rooms) {
    if (r === spawnRoom) continue;
    addPillars(tiles, width, r, rng, randInt(rng, 1, pillarBudget));
  }
  // Never bury the spawn or exit tiles.
  tiles[spawn.y * width + spawn.x] = TileKind.Floor;
  tiles[exit.y * width + exit.x] = TileKind.Floor;

  // Monsters: one pursuer waits in the exit room; the rest lurk elsewhere.
  const monsters = [makeMonster("pursuer", exitRoom)];
  const otherRooms = rooms.filter((r) => r !== spawnRoom && r !== exitRoom);
  for (let i = 1; i < monsterCount; i++) {
    const room = otherRooms.length > 0 ? pick(rng, otherRooms) : exitRoom;
    monsters.push(makeMonster(`lurker-${i}`, room));
  }
  // Keep every monster spawn and patrol tile walkable (a pillar may have
  // landed on a room centre).
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
    zones: [],
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
