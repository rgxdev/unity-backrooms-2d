import { describe, expect, it } from "vitest";
import { LevelSchema, parseLevel } from "./level";

const validRaw = {
  id: "test",
  name: "Test",
  tileSize: 32,
  width: 2,
  height: 2,
  tiles: [1, 1, 1, 0],
  spawn: { x: 1, y: 1 },
  zones: [],
};

describe("LevelSchema", () => {
  it("parses a valid level", () => {
    expect(() => parseLevel(validRaw)).not.toThrow();
  });

  it("rejects a tiles/dimension mismatch", () => {
    const bad = { ...validRaw, tiles: [1, 1, 1] };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an out-of-bounds spawn", () => {
    const bad = { ...validRaw, spawn: { x: 5, y: 0 } };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an exit on a wall tile", () => {
    const bad = { ...validRaw, exit: { x: 0, y: 0 } };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });
});
