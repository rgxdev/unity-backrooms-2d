import { describe, expect, it } from "vitest";
import {
  getStats,
  recordDeath,
  recordEscape,
  recordFall,
  recordRunStart,
} from "./stats-store";

describe("stats-store", () => {
  it("accumulates counters and playtime across recordings", () => {
    const before = getStats();

    recordRunStart();
    const afterEscape = recordEscape(1000);
    const afterDeath = recordDeath(500);
    const afterFall = recordFall(250);

    expect(afterEscape.runsStarted).toBe(before.runsStarted + 1);
    expect(afterEscape.escapes).toBe(before.escapes + 1);
    expect(afterDeath.deaths).toBe(before.deaths + 1);
    expect(afterFall.falls).toBe(before.falls + 1);
    expect(afterFall.playTimeMs).toBe(before.playTimeMs + 1750);
  });

  it("clamps negative playtime to zero instead of subtracting", () => {
    const before = getStats();
    const after = recordEscape(-500);
    expect(after.playTimeMs).toBe(before.playTimeMs);
  });
});
