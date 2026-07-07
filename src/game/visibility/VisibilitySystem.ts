export const TileVisibility = {
  Unseen: 0,
  Discovered: 1,
  Visible: 2,
} as const;

export type IsWallFn = (tileX: number, tileY: number) => boolean;

/**
 * Grid fog-of-war with line-of-sight reveal. Engine-independent so it can be
 * unit tested in isolation. No per-update heap allocation: the state buffers
 * are created once and mutated in place.
 */
export class VisibilitySystem {
  readonly width: number;
  readonly height: number;
  private currentRadius: number;

  private readonly state: Uint8Array;

  constructor(width: number, height: number, radius: number) {
    this.width = width;
    this.height = height;
    this.currentRadius = radius;
    this.state = new Uint8Array(width * height);
  }

  get radius(): number {
    return this.currentRadius;
  }

  /** Temporarily widen (or restore) the reveal radius — used by the Almond
   *  Water pickup's brief vision boost. Takes effect on the next update(). */
  setRadius(radius: number): void {
    this.currentRadius = radius;
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getState(x: number, y: number): number {
    if (!this.inBounds(x, y)) return TileVisibility.Unseen;
    return this.state[this.index(x, y)] as number;
  }

  /** Demote all currently-visible tiles to discovered before a fresh pass. */
  private demote(): void {
    const s = this.state;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === TileVisibility.Visible) s[i] = TileVisibility.Discovered;
    }
  }

  update(originX: number, originY: number, isWall: IsWallFn): void {
    this.demote();
    const r = this.radius;
    const r2 = r * r;
    const minX = Math.max(0, originX - r);
    const maxX = Math.min(this.width - 1, originX + r);
    const minY = Math.max(0, originY - r);
    const maxY = Math.min(this.height - 1, originY + r);

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - originX;
        const dy = ty - originY;
        if (dx * dx + dy * dy > r2) continue;
        if (this.hasLineOfSight(originX, originY, tx, ty, isWall)) {
          this.state[this.index(tx, ty)] = TileVisibility.Visible;
        }
      }
    }
    this.state[this.index(originX, originY)] = TileVisibility.Visible;
  }

  /** Bresenham walk; a wall blocks the tiles behind it but is itself visible. */
  hasLineOfSight(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    isWall: IsWallFn,
  ): boolean {
    let cx = x0;
    let cy = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
      if (cx === x1 && cy === y1) break;
      if (isWall(cx, cy)) return false;
    }
    return true;
  }
}
