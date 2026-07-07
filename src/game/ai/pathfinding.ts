/**
 * Grid pathfinding for the Pursuit-phase chase. Direct line-of-sight steering
 * (see steering.ts) beelines straight at the player and gets stuck shoving
 * against walls whenever a corridor bends — this walks an actual route
 * through the maze instead. Kept Phaser-free so it's unit testable.
 */

export interface TileVec2 {
  x: number;
  y: number;
}

const DIRECTIONS: TileVec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Breadth-first search over a 4-directional tile grid (unweighted, so BFS
 * already gives the shortest route — no need for A*). Returns the path from
 * `start` to `goal` inclusive of both ends, or `null` if `goal` is
 * unreachable.
 */
export function findPath(
  start: TileVec2,
  goal: TileVec2,
  width: number,
  height: number,
  isWall: (x: number, y: number) => boolean,
): TileVec2[] | null {
  const key = (x: number, y: number) => y * width + x;
  if (
    start.x < 0 ||
    start.y < 0 ||
    start.x >= width ||
    start.y >= height ||
    goal.x < 0 ||
    goal.y < 0 ||
    goal.x >= width ||
    goal.y >= height
  ) {
    return null;
  }
  if (start.x === goal.x && start.y === goal.y) return [start];

  const cameFrom = new Int32Array(width * height).fill(-1);
  const visited = new Uint8Array(width * height);
  const queue: TileVec2[] = [start];
  visited[key(start.x, start.y)] = 1;

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++]!;
    const curKey = key(cur.x, cur.y);
    for (const d of DIRECTIONS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nk = key(nx, ny);
      if (visited[nk]) continue;
      if (isWall(nx, ny)) continue;
      visited[nk] = 1;
      cameFrom[nk] = curKey;
      if (nx === goal.x && ny === goal.y) {
        return reconstruct(cameFrom, curKey, nk, width);
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function reconstruct(
  cameFrom: Int32Array,
  lastNodeKey: number,
  goalKey: number,
  width: number,
): TileVec2[] {
  const toTile = (k: number): TileVec2 => ({
    x: k % width,
    y: Math.floor(k / width),
  });
  const path: TileVec2[] = [toTile(goalKey)];
  let k = lastNodeKey;
  while (k !== -1) {
    path.push(toTile(k));
    k = cameFrom[k]!;
  }
  path.reverse();
  return path;
}
