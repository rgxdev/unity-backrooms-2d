import { describe, expect, it } from "vitest";
import { completeLevel, getProgress } from "./progress-store";
import { getSkin } from "@/game/skins/skinCatalog";

describe("completeLevel", () => {
  it("unlocks the reward skin tied to the level just beaten", () => {
    const before = getProgress();
    expect(before.unlockedSkins).not.toContain("lobby-khaki");

    const after = completeLevel(0);

    expect(after.unlockedSkins).toContain("lobby-khaki");
    expect(after.unlockedSkins).toContain("default");
    expect(getSkin("lobby-khaki").unlockLevel).toBe(0);
  });

  it("does not duplicate an already-unlocked skin", () => {
    completeLevel(0);
    const after = completeLevel(0);
    const occurrences = after.unlockedSkins.filter(
      (id) => id === "lobby-khaki",
    );
    expect(occurrences.length).toBe(1);
  });
});
