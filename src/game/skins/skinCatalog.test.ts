import { describe, expect, it } from "vitest";
import { LAST_LEVEL_INDEX } from "@/game/levels/officialLevels";
import {
  DEFAULT_SKIN_ID,
  getSkin,
  resolveEquippedSkinId,
  SKINS,
} from "./skinCatalog";

describe("SKINS", () => {
  it("has unique ids", () => {
    const ids = SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes an always-unlocked default skin", () => {
    const def = getSkin(DEFAULT_SKIN_ID);
    expect(def.unlockLevel).toBeUndefined();
  });

  it("gates every other skin behind a valid, distinct official level", () => {
    const rewardSkins = SKINS.filter((s) => s.id !== DEFAULT_SKIN_ID);
    expect(rewardSkins.length).toBeGreaterThan(0);
    const levels = rewardSkins.map((s) => s.unlockLevel);
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(LAST_LEVEL_INDEX);
    }
    expect(new Set(levels).size).toBe(levels.length);
  });
});

describe("getSkin", () => {
  it("falls back to the default skin for an unknown id", () => {
    expect(getSkin("nonexistent").id).toBe(DEFAULT_SKIN_ID);
  });
});

describe("resolveEquippedSkinId", () => {
  it("keeps the equipped skin when unlocked", () => {
    expect(
      resolveEquippedSkinId(["default", "lobby-khaki"], "lobby-khaki"),
    ).toBe("lobby-khaki");
  });

  it("falls back to default when the equipped skin isn't unlocked", () => {
    expect(resolveEquippedSkinId(["default"], "lobby-khaki")).toBe(
      DEFAULT_SKIN_ID,
    );
  });
});
