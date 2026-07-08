import { parseLevel, TileKind, type LevelData, type Zone } from "@/lib/schemas/level";
import type { Difficulty } from "@/lib/schemas/settings";
import { DIFFICULTY_CONFIG, MAX_MONSTERS } from "@/game/config/constants";
import { chance, makeRng, pick, randInt, shuffle, type Rng } from "./rng";
import { pickWallExit } from "./wallExit";
import { resolveMonsterKind } from "./roster";

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

/**
 * A regular grid of structural pillars filling a large room — the classic
 * Backrooms "pillar hall" (Level 0's documented pillar variation, Level 1's
 * warehouse pillar rows), distinct from {@link addPillars}' random scatter.
 * Spacing keeps every aisle at least two tiles wide and the room centre
 * clear for corridor connections.
 */
function pillarGridHall(tiles: number[], width: number, r: Room): void {
  const c = roomCentre(r);
  for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) {
    for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) {
      if (Math.abs(x - c.x) <= 1 && Math.abs(y - c.y) <= 1) continue;
      tiles[y * width + x] = TileKind.Wall;
    }
  }
}

/**
 * Roll 0–2 of the documented themed sub-sections (sticky Red Rooms, unlit
 * Blackout Zones — see `ZoneKind` and MainScene's zone masks) over interior
 * rooms. Previously Level 0's hand-authored generator was the only place
 * these existed; now any generated level can carry them, so consecutive runs
 * of the same level read differently. Spawn and exit rooms stay untouched.
 */
function addThemedZones(
  rooms: readonly Room[],
  spawnRoom: Room,
  exitRoom: Room,
  rng: Rng,
): Zone[] {
  const candidates = rooms.filter((r) => r !== spawnRoom && r !== exitRoom);
  if (candidates.length === 0) return [];
  const zones: Zone[] = [];
  const count = chance(rng, 0.55) ? (chance(rng, 0.35) ? 2 : 1) : 0;
  const pool = shuffle(rng, [...candidates]);
  for (let i = 0; i < count && i < pool.length; i++) {
    const room = pool[i]!;
    const kind = chance(rng, 0.5) ? "red" : "blackout";
    zones.push({
      id: `${kind}-zone-${i}`,
      x: room.x,
      y: room.y,
      width: room.w,
      height: room.h,
      hidden: false,
      kind,
    });
  }
  return zones;
}

/**
 * Wall off a random rectangular corner of the room so it reads as an L-shape
 * instead of every room being a plain rectangle — pure shape variety, applied
 * before corridors are carved so the centre point corridors connect to always
 * stays clear.
 */
function biteCorner(tiles: number[], width: number, r: Room, rng: Rng): void {
  if (r.w < 7 || r.h < 7 || !chance(rng, 0.35)) return;
  const bw = randInt(rng, 2, Math.floor(r.w / 2) - 1);
  const bh = randInt(rng, 2, Math.floor(r.h / 2) - 1);
  const corner = randInt(rng, 0, 3);
  const bx = corner === 1 || corner === 3 ? r.x + r.w - bw : r.x;
  const by = corner === 2 || corner === 3 ? r.y + r.h - bh : r.y;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      tiles[y * width + x] = TileKind.Wall;
    }
  }
}

/**
 * A small hidden room tucked near a random existing room, connected by a
 * normal corridor but masked (like the level-0 Manila room) until physically
 * entered. Purely a "was that always there?" variety beat — not every level
 * gets one.
 */
function addSecretRoom(
  tiles: number[],
  width: number,
  height: number,
  rooms: Room[],
  rng: Rng,
): { zone: Zone; room: Room } | null {
  if (!chance(rng, 0.5)) return null;
  const host = pick(rng, rooms);
  const hc = roomCentre(host);
  for (let attempt = 0; attempt < 10; attempt++) {
    const w = randInt(rng, 3, 5);
    const h = randInt(rng, 3, 5);
    const x = clamp(hc.x + randInt(rng, -10, 10), 1, width - w - 1);
    const y = clamp(hc.y + randInt(rng, -10, 10), 1, height - h - 1);
    const room: Room = { x, y, w, h };
    if (rooms.some((r) => roomsOverlap(r, room, 2))) continue;
    carveRoom(tiles, width, room);
    carveCorridor(tiles, width, height, hc, roomCentre(room), rng);
    rooms.push(room);
    return {
      room,
      zone: {
        id: "secret-room",
        x: room.x,
        y: room.y,
        width: room.w,
        height: room.h,
        hidden: true,
      },
    };
  }
  return null;
}

function makeMonster(id: string, room: Room, rng: Rng, levelIndex: number) {
  const inset = 1;
  const corners = [
    { x: room.x + inset, y: room.y + inset },
    { x: room.x + room.w - 1 - inset, y: room.y + inset },
    { x: room.x + room.w - 1 - inset, y: room.y + room.h - 1 - inset },
    { x: room.x + inset, y: room.y + room.h - 1 - inset },
  ];
  const c = roomCentre(room);

  // Vary the patrol shape so not every monster loops all four corners the
  // same way: sometimes a simple back-and-forth, sometimes a shorter loop.
  let patrol = corners;
  if (room.w >= 6 && room.h >= 6) {
    const style = randInt(rng, 0, 2);
    if (style === 1) patrol = [corners[0]!, corners[2]!];
    else if (style === 2) {
      const skip = randInt(rng, 0, 3);
      patrol = corners.filter((_, i) => i !== skip);
    }
  }
  // The pursuer role is level-agnostic and never rolled from the roster;
  // every other spawn draws its kind from the level's roster (deterministic
  // per seed since it consumes the shared `rng`).
  const kind = resolveMonsterKind(id, rng, levelIndex);
  return { id, x: c.x, y: c.y, patrol, kind };
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
    // Shape variety — skip the very first (spawn) room so the start stays a
    // plain, easy-to-read rectangle.
    if (rooms.length > 1) biteCorner(tiles, width, room, rng);
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

  // A rare hidden pocket off an existing room — added after spawn/exit are
  // locked in so it can never accidentally become either.
  const secret = addSecretRoom(tiles, width, height, rooms, rng);
  const zones: Zone[] = secret ? [secret.zone] : [];

  // Documented themed sub-sections (Red Rooms / Blackout Zones) over interior
  // rooms — rolled after spawn/exit and before pillars so the zone rect
  // matches the room it covers. The secret room stays plain: it's a refuge.
  zones.push(
    ...addThemedZones(
      rooms.filter((r) => r !== secret?.room),
      spawnRoom,
      exitRoom,
      rng,
    ),
  );

  // Interior pillars (skip the spawn room so the start stays open). Large
  // rooms occasionally trade the random scatter for a regular pillar-grid
  // hall — the documented Backrooms "pillar variation".
  const pillarBudget = input.difficulty === "easy" ? 2 : 3;
  for (const r of rooms) {
    if (r === spawnRoom) continue;
    if (r.w >= 9 && r.h >= 9 && chance(rng, 0.3)) {
      pillarGridHall(tiles, width, r);
      continue;
    }
    addPillars(tiles, width, r, rng, randInt(rng, 1, pillarBudget));
  }
  // Never bury the spawn or exit tiles.
  tiles[spawn.y * width + spawn.x] = TileKind.Floor;
  tiles[exit.y * width + exit.x] = TileKind.Floor;

  // Monsters: one pursuer waits in the exit room; the rest lurk elsewhere.
  // The secret room (if any) stays monster-free — it's meant as a safe pocket.
  // Round-robin a shuffled room order (instead of an independent random pick
  // per monster) so lurkers spread across distinct rooms first and only ever
  // repeat a room once every other one already has a threat — otherwise
  // several can land in the same room and clump into a crowd that's visible
  // together nonstop instead of one threat at a time.
  const monsters = [makeMonster("pursuer", exitRoom, rng, input.levelIndex)];
  const otherRooms = shuffle(
    rng,
    rooms.filter((r) => r !== spawnRoom && r !== exitRoom && r !== secret?.room),
  );
  for (let i = 1; i < monsterCount; i++) {
    const room =
      otherRooms.length > 0
        ? otherRooms[(i - 1) % otherRooms.length]!
        : exitRoom;
    monsters.push(makeMonster(`lurker-${i}`, room, rng, input.levelIndex));
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
