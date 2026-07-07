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
  /** 1 where the last update() call's ambient circle reveals that tile —
   *  lets updateCone() know which tiles it must never demote out from under
   *  the ambient reveal. */
  private readonly ambientMask: Uint8Array;
  /** Tile indices the last updateCone() call marked Visible, so the next
   *  call (or clearCone()) can demote whichever of them fall outside the
   *  fresh beam. */
  private coneTiles: number[] = [];

  constructor(width: number, height: number, radius: number) {
    this.width = width;
    this.height = height;
    this.currentRadius = radius;
    this.state = new Uint8Array(width * height);
    this.ambientMask = new Uint8Array(width * height);
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
    this.ambientMask.fill(0);
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
          const idx = this.index(tx, ty);
          this.state[idx] = TileVisibility.Visible;
          this.ambientMask[idx] = 1;
        }
      }
    }
    const originIdx = this.index(originX, originY);
    this.state[originIdx] = TileVisibility.Visible;
    this.ambientMask[originIdx] = 1;
  }

  /**
   * Reveal tiles inside a directional cone (the flashlight beam), additive on
   * top of whatever the last update() call's ambient circle already covers.
   * Idempotent per call — safe to call every time the beam direction changes.
   * Tiles the beam sweeps away from fall back to Discovered unless the
   * ambient circle still covers them; call clearCone() when the beam turns off.
   */
  updateCone(
    originX: number,
    originY: number,
    angleRad: number,
    halfAngleRad: number,
    radius: number,
    isWall: IsWallFn,
  ): void {
    this.clearCone();
    const r2 = radius * radius;
    const minX = Math.max(0, originX - radius);
    const maxX = Math.min(this.width - 1, originX + radius);
    const minY = Math.max(0, originY - radius);
    const maxY = Math.min(this.height - 1, originY + radius);

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - originX;
        const dy = ty - originY;
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy > r2) continue;
        const idx = this.index(tx, ty);
        if (this.ambientMask[idx]) continue;
        let diff = Math.abs(Math.atan2(dy, dx) - angleRad);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > halfAngleRad) continue;
        if (!this.hasLineOfSight(originX, originY, tx, ty, isWall)) continue;
        this.state[idx] = TileVisibility.Visible;
        this.coneTiles.push(idx);
      }
    }
  }

  /** Demotes whatever the last updateCone() call revealed back to Discovered,
   *  unless the ambient circle from the last update() call also covers it. */
  clearCone(): void {
    for (const idx of this.coneTiles) {
      if (this.ambientMask[idx]) continue;
      if (this.state[idx] === TileVisibility.Visible) {
        this.state[idx] = TileVisibility.Discovered;
      }
    }
    this.coneTiles = [];
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
