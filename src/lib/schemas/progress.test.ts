import { describe, expect, it } from "vitest";
import { DEFAULT_PROGRESS, parseProgress } from "./progress";

describe("parseProgress", () => {
  it("returns defaults for invalid input", () => {
    expect(parseProgress(null)).toEqual(DEFAULT_PROGRESS);
    expect(parseProgress({ currentLevel: -1 })).toEqual(DEFAULT_PROGRESS);
  });

  it("keeps valid overrides", () => {
    const parsed = parseProgress({
      ...DEFAULT_PROGRESS,
      currentLevel: 2,
      unlocked: [0, 1, 2],
      unlockedSkins: ["default", "lobby-khaki"],
    });
    expect(parsed.currentLevel).toBe(2);
    expect(parsed.unlockedSkins).toEqual(["default", "lobby-khaki"]);
  });

  it("defaults unlockedSkins for pre-existing saves without it", () => {
    const parsed = parseProgress({
      version: 1,
      currentLevel: 1,
      unlocked: [0, 1],
    });
    expect(parsed.unlockedSkins).toEqual(["default"]);
  });
});
