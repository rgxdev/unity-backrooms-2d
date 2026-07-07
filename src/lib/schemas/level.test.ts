import { describe, expect, it } from "vitest";
import { LevelSchema, parseLevel } from "./level";
import { LEVEL_00 } from "@/game/levels/level-00";

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

  it("accepts the bundled level-00", () => {
    expect(LEVEL_00.tiles.length).toBe(LEVEL_00.width * LEVEL_00.height);
  });
});
