import { describe, expect, it } from "vitest";
import { TileVisibility, VisibilitySystem } from "./VisibilitySystem";

const noWalls = () => false;

describe("VisibilitySystem", () => {
  it("marks the origin tile visible", () => {
    const vis = new VisibilitySystem(10, 10, 4);
    vis.update(5, 5, noWalls);
    expect(vis.getState(5, 5)).toBe(TileVisibility.Visible);
  });

  it("reveals tiles within radius on an open grid", () => {
    const vis = new VisibilitySystem(10, 10, 4);
    vis.update(5, 5, noWalls);
    expect(vis.getState(7, 5)).toBe(TileVisibility.Visible);
  });

  it("does not reveal tiles beyond radius", () => {
    const vis = new VisibilitySystem(20, 20, 3);
    vis.update(10, 10, noWalls);
    expect(vis.getState(15, 10)).toBe(TileVisibility.Unseen);
  });

  it("blocks line of sight behind a wall", () => {
    const wallAt = (x: number, y: number) => x === 7 && y === 5;
    const vis = new VisibilitySystem(12, 12, 6);
    vis.update(5, 5, wallAt);
    expect(vis.getState(9, 5)).toBe(TileVisibility.Unseen);
  });

  it("demotes previously visible tiles to discovered", () => {
    const vis = new VisibilitySystem(20, 20, 4);
    vis.update(5, 5, noWalls);
    expect(vis.getState(5, 5)).toBe(TileVisibility.Visible);
    vis.update(15, 15, noWalls);
    expect(vis.getState(5, 5)).toBe(TileVisibility.Discovered);
  });
});
