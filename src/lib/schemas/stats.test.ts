import { describe, expect, it } from "vitest";
import { DEFAULT_STATS, parseStats } from "./stats";

describe("parseStats", () => {
  it("returns defaults for invalid input", () => {
    expect(parseStats(null)).toEqual(DEFAULT_STATS);
    expect(parseStats({ escapes: -1 })).toEqual(DEFAULT_STATS);
  });

  it("keeps valid overrides", () => {
    const parsed = parseStats({
      ...DEFAULT_STATS,
      runsStarted: 5,
      escapes: 3,
      deaths: 1,
      falls: 1,
      playTimeMs: 12_345,
    });
    expect(parsed.runsStarted).toBe(5);
    expect(parsed.escapes).toBe(3);
    expect(parsed.playTimeMs).toBe(12_345);
  });
});
