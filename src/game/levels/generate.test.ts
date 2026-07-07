import { describe, expect, it } from "vitest";
import { generateLevel, type GenerateInput } from "./generate";
import { TileKind, type LevelData } from "@/lib/schemas/level";

const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  levelId: "level-0",
  levelName: "Test",
  difficulty: "easy",
  levelIndex: 0,
  seed: 12345,
  ...over,
});

/** Flood fill from spawn; return the set of reachable floor tile indices. */
function reachable(level: LevelData): Set<number> {
  const { width, tiles, spawn } = level;
  const seen = new Set<number>();
  const start = spawn.y * width + spawn.x;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i) || tiles[i] === TileKind.Wall) continue;
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

describe("generateLevel", () => {
  it("produces a schema-valid level", () => {
    // generateLevel calls parseLevel internally — would throw if invalid.
    expect(() => generateLevel(input())).not.toThrow();
  });

  it("is deterministic for a given seed", () => {
    const a = generateLevel(input({ seed: 999 }));
    const b = generateLevel(input({ seed: 999 }));
    expect(a.tiles).toEqual(b.tiles);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.exit).toEqual(b.exit);
  });

  it("varies with the seed", () => {
    const a = generateLevel(input({ seed: 1 }));
    const b = generateLevel(input({ seed: 2 }));
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it("keeps the exit reachable from the spawn", () => {
    for (const seed of [1, 42, 777, 2024, 99999]) {
      const level = generateLevel(input({ seed, difficulty: "hard" }));
      const seen = reachable(level);
      const exitIdx = level.exit!.y * level.width + level.exit!.x;
      expect(seen.has(exitIdx)).toBe(true);
    }
  });

  it("reaches every monster from the spawn", () => {
    const level = generateLevel(input({ seed: 7, difficulty: "middle" }));
    const seen = reachable(level);
    for (const m of level.monsters) {
      expect(seen.has(m.y * level.width + m.x)).toBe(true);
    }
  });

  it("scales up with difficulty and level index", () => {
    const easy = generateLevel(input({ difficulty: "easy", levelIndex: 0 }));
    const hard = generateLevel(input({ difficulty: "hard", levelIndex: 3 }));
    expect(hard.width).toBeGreaterThan(easy.width);
    expect(hard.height).toBeGreaterThan(easy.height);
    expect(hard.monsters.length).toBeGreaterThan(easy.monsters.length);
  });

  it("always has a spawn, exit and pursuit trigger", () => {
    const level = generateLevel(input({ seed: 3 }));
    expect(level.exit).toBeDefined();
    expect(level.pursuitTrigger).toBeDefined();
    expect(level.monsters.length).toBeGreaterThanOrEqual(1);
  });
});
