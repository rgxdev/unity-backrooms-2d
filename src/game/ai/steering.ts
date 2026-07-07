/**
 * Pure vector steering helpers shared by the monster entity. Kept free of
 * Phaser so movement math is unit testable in isolation.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Velocity vector that moves `from` toward `to` at `speed` units/sec. Returns a
 * zero vector when the points coincide (avoids NaN from normalising 0).
 */
export function seekVelocity(from: Vec2, to: Vec2, speed: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: (dx / len) * speed, y: (dy / len) * speed };
}

export function hasReached(from: Vec2, to: Vec2, radius: number): boolean {
  return distance(from, to) <= radius;
}

/** Advance a looping patrol index, wrapping back to the start at the end. */
export function nextWaypointIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (index + 1) % length;
}
