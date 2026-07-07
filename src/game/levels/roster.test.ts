import { describe, expect, it } from "vitest";
import { makeRng } from "./rng";
import { LEVEL_MONSTER_ROSTER, pickMonsterKind } from "./roster";

describe("pickMonsterKind", () => {
  it("is deterministic for a given seed and level", () => {
    const seq1 = Array.from({ length: 10 }, (_, i) =>
      pickMonsterKind(makeRng(100 + i), 1),
    );
    const seq2 = Array.from({ length: 10 }, (_, i) =>
      pickMonsterKind(makeRng(100 + i), 1),
    );
    expect(seq2).toEqual(seq1);
  });

  it("never rolls a Hound on Level 0 (Upper-Levels-only entity)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      expect(pickMonsterKind(rng, 0)).not.toBe("hound");
    }
  });

  it("only ever rolls kinds present in that level's authored roster", () => {
    const rng = makeRng(9);
    for (const [levelIndex, roster] of Object.entries(LEVEL_MONSTER_ROSTER)) {
      const allowed = new Set(roster.map((r) => r.kind));
      for (let i = 0; i < 200; i++) {
        expect(allowed.has(pickMonsterKind(rng, Number(levelIndex)))).toBe(true);
      }
    }
  });

  it("falls back to Level 0's roster for an unauthored level index", () => {
    const rng = makeRng(3);
    const allowed = new Set(LEVEL_MONSTER_ROSTER[0]!.map((r) => r.kind));
    for (let i = 0; i < 50; i++) {
      expect(allowed.has(pickMonsterKind(rng, 99))).toBe(true);
    }
  });
});
