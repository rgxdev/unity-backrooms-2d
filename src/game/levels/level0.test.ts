import { describe, expect, it } from "vitest";
import { generateLevel0 } from "./level0";
import type { GenerateInput } from "./generate";
import { TileKind, type LevelData } from "@/lib/schemas/level";

const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  levelId: "level-0",
  levelName: "Level 0 — The Lobby",
  difficulty: "easy",
  levelIndex: 0,
  seed: 12345,
  ...over,
});

/**
 * Flood fill from spawn over *safe* tiles only — walls and bottomless holes
 * both block. This proves a pit-free route exists, not just any route.
 */
function safeReachable(level: LevelData): Set<number> {
  const { width, tiles, spawn } = level;
  const seen = new Set<number>();
  const stack = [spawn.y * width + spawn.x];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    if (tiles[i] === TileKind.Wall || tiles[i] === TileKind.Hole) continue;
    seen.add(i);
    const x = i % width;
    const y = Math.floor(i / width);
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < level.height - 1) stack.push(i + width);
  }
  return seen;
}

describe("generateLevel0", () => {
  it("produces a schema-valid level", () => {
    expect(() => generateLevel0(input())).not.toThrow();
  });

  it("is deterministic for a given seed", () => {
    const a = generateLevel0(input({ seed: 999 }));
    const b = generateLevel0(input({ seed: 999 }));
    expect(a.tiles).toEqual(b.tiles);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.exit).toEqual(b.exit);
  });

  it("keeps a pit-free route from spawn to the exit", () => {
    for (const seed of [1, 42, 777, 2024, 99999]) {
      for (const difficulty of ["easy", "middle", "hard"] as const) {
        const level = generateLevel0(input({ seed, difficulty }));
        const seen = safeReachable(level);
        const exitIdx = level.exit!.y * level.width + level.exit!.x;
        expect(seen.has(exitIdx)).toBe(true);
      }
    }
  });

  it("reaches every monster from the spawn", () => {
    const level = generateLevel0(input({ seed: 7, difficulty: "hard" }));
    const seen = safeReachable(level);
    for (const m of level.monsters) {
      expect(seen.has(m.y * level.width + m.x)).toBe(true);
    }
  });

  it("contains the documented hazards: holes and themed zones", () => {
    const level = generateLevel0(input({ seed: 3 }));
    expect(level.tiles.some((t) => t === TileKind.Hole)).toBe(true);
    const kinds = new Set(level.zones.map((z) => z.kind));
    expect(kinds.has("red")).toBe(true);
    expect(kinds.has("blackout")).toBe(true);
    expect(kinds.has("manila")).toBe(true);
  });

  it("always has a spawn, exit and pursuit trigger", () => {
    const level = generateLevel0(input({ seed: 3 }));
    expect(level.exit).toBeDefined();
    expect(level.pursuitTrigger).toBeDefined();
    expect(level.monsters.length).toBeGreaterThanOrEqual(1);
  });
});
