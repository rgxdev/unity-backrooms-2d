import { describe, expect, it } from "vitest";
import { makeRng, weightedPick } from "./rng";

describe("weightedPick", () => {
  it("always returns the only item when there's just one", () => {
    const rng = makeRng(1);
    const only = { weight: 1, id: "a" };
    for (let i = 0; i < 20; i++) {
      expect(weightedPick(rng, [only])).toBe(only);
    }
  });

  it("never picks a zero-weight item", () => {
    const rng = makeRng(2);
    const a = { weight: 0, id: "a" };
    const b = { weight: 1, id: "b" };
    for (let i = 0; i < 50; i++) {
      expect(weightedPick(rng, [a, b]).id).toBe("b");
    }
  });

  it("distributes roughly proportional to weight over many draws", () => {
    const rng = makeRng(42);
    const items = [
      { weight: 1, id: "rare" },
      { weight: 3, id: "common" },
    ];
    const counts: Record<string, number> = { rare: 0, common: 0 };
    const draws = 4000;
    for (let i = 0; i < draws; i++) {
      counts[weightedPick(rng, items).id]!++;
    }
    // Expected ~25%/75% split; allow generous tolerance for PRNG variance.
    expect(counts.rare! / draws).toBeGreaterThan(0.15);
    expect(counts.rare! / draws).toBeLessThan(0.35);
  });
});
