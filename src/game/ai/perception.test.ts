import { describe, expect, it } from "vitest";
import { buildPerception, type PerceptionInput } from "./perception";

const base = (over: Partial<PerceptionInput> = {}): PerceptionInput => ({
  monster: { x: 0, y: 0 },
  player: { x: 100, y: 0 },
  sightRange: 260,
  hearingRange: 180,
  noises: [],
  hasLineOfSight: () => true,
  ...over,
});

describe("buildPerception", () => {
  it("sees the player when in range with line of sight", () => {
    const p = buildPerception(base());
    expect(p.canSeePlayer).toBe(true);
    expect(p.distanceToPlayer).toBe(100);
  });

  it("does not see the player beyond sight range", () => {
    const p = buildPerception(base({ player: { x: 400, y: 0 } }));
    expect(p.canSeePlayer).toBe(false);
  });

  it("does not see the player when line of sight is blocked", () => {
    const p = buildPerception(base({ hasLineOfSight: () => false }));
    expect(p.canSeePlayer).toBe(false);
  });

  it("hears a noise inside the hearing radius", () => {
    const p = buildPerception(
      base({ hasLineOfSight: () => false, noises: [{ x: 50, y: 0 }] }),
    );
    expect(p.heardNoise).toBe(true);
  });

  it("ignores a noise beyond the hearing radius", () => {
    const p = buildPerception(base({ noises: [{ x: 500, y: 0 }] }));
    expect(p.heardNoise).toBe(false);
  });
});
