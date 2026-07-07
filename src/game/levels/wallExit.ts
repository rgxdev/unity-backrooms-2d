import { TileKind } from "@/lib/schemas/level";
import { shuffle, type Rng } from "./rng";

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Pick an exit position that reads as a genuine niche broken into the wall
 * bank surrounding a room, instead of a tile floating in the open room
 * interior. Scans the four sides of `room` for a spot that is currently a
 * real wall (not a corridor punch-through) with another wall (or the map
 * edge) directly behind it — a dead-end pocket, not a passage — then hands
 * that tile back so the caller can carve it to floor and dress it as the
 * exit. Falls back to `null` if no such spot exists (tiny/edge-case rooms),
 * letting the caller use its old corner-of-the-room placement instead.
 */
export function pickWallExit(
  tiles: readonly number[],
  width: number,
  height: number,
  room: Room,
  rng: Rng,
): Point | null {
  const isWall = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && tiles[y * width + x] === TileKind.Wall;

  type Candidate = Point & { dx: number; dy: number };
  const sides: Candidate[][] = [
    // North: one tile above the room's top edge, stepping further north.
    Array.from({ length: Math.max(0, room.w - 2) }, (_, i) => ({
      x: room.x + 1 + i,
      y: room.y - 1,
      dx: 0,
      dy: -1,
    })),
    // South.
    Array.from({ length: Math.max(0, room.w - 2) }, (_, i) => ({
      x: room.x + 1 + i,
      y: room.y + room.h,
      dx: 0,
      dy: 1,
    })),
    // West.
    Array.from({ length: Math.max(0, room.h - 2) }, (_, i) => ({
      x: room.x - 1,
      y: room.y + 1 + i,
      dx: -1,
      dy: 0,
    })),
    // East.
    Array.from({ length: Math.max(0, room.h - 2) }, (_, i) => ({
      x: room.x + room.w,
      y: room.y + 1 + i,
      dx: 1,
      dy: 0,
    })),
  ];

  for (const side of shuffle(rng, sides)) {
    for (const c of shuffle(rng, side)) {
      if (!isWall(c.x, c.y)) continue; // a corridor already punched through here
      const beyondX = c.x + c.dx;
      const beyondY = c.y + c.dy;
      const beyondIsWallOrEdge =
        beyondX < 0 ||
        beyondY < 0 ||
        beyondX >= width ||
        beyondY >= height ||
        isWall(beyondX, beyondY);
      if (beyondIsWallOrEdge) return { x: c.x, y: c.y };
    }
  }
  return null;
}
