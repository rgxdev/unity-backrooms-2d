import { describe, expect, it } from "vitest";
import { findPath } from "./pathfinding";

describe("findPath", () => {
  it("returns a single-tile path when start equals goal", () => {
    const path = findPath(
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      5,
      5,
      () => false,
    );
    expect(path).toEqual([{ x: 2, y: 2 }]);
  });

  it("finds the shortest route on an open grid", () => {
    const path = findPath(
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      5,
      5,
      () => false,
    );
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it("routes around a wall instead of cutting through it", () => {
    // A vertical wall at x=1 blocks the direct line, except for a gap at y=2.
    const isWall = (x: number, y: number) => x === 1 && y !== 2;
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, 5, 5, isWall);
    expect(path).not.toBeNull();
    for (const tile of path!) expect(isWall(tile.x, tile.y)).toBe(false);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it("returns null when the goal is unreachable", () => {
    const isWall = (x: number) => x === 1;
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, 5, 5, isWall);
    expect(path).toBeNull();
  });

  it("returns null when goal is out of bounds", () => {
    const path = findPath({ x: 0, y: 0 }, { x: 10, y: 10 }, 5, 5, () => false);
    expect(path).toBeNull();
  });
});
