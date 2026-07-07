import { describe, expect, it } from "vitest";
import {
  distance,
  hasReached,
  nextWaypointIndex,
  seekVelocity,
} from "./steering";

describe("steering", () => {
  it("measures euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("seeks toward a target at the requested speed", () => {
    const v = seekVelocity({ x: 0, y: 0 }, { x: 10, y: 0 }, 50);
    expect(v).toEqual({ x: 50, y: 0 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(50);
  });

  it("returns a zero vector when already at the target", () => {
    expect(seekVelocity({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("reports reached only within the radius", () => {
    expect(hasReached({ x: 0, y: 0 }, { x: 3, y: 0 }, 4)).toBe(true);
    expect(hasReached({ x: 0, y: 0 }, { x: 6, y: 0 }, 4)).toBe(false);
  });

  it("loops the patrol index back to the start", () => {
    expect(nextWaypointIndex(0, 3)).toBe(1);
    expect(nextWaypointIndex(2, 3)).toBe(0);
    expect(nextWaypointIndex(0, 0)).toBe(0);
  });
});
