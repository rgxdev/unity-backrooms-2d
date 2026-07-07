import { describe, expect, it } from "vitest";
import { DEFAULT_STALKER_CONFIG, StalkerAI, StalkerState } from "./StalkerAI";

const P = (
  over: Partial<{ seen: boolean; distanceToPlayer: number }> = {},
) => ({
  seen: false,
  distanceToPlayer: Infinity,
  ...over,
});

describe("StalkerAI", () => {
  it("starts lurking", () => {
    expect(new StalkerAI().current).toBe(StalkerState.Lurking);
  });

  it("stays lurking outside the trigger radius", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 9999 }));
    expect(s.current).toBe(StalkerState.Lurking);
  });

  it("starts creeping once in range and unseen", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 100 }));
    expect(s.current).toBe(StalkerState.Creeping);
  });

  it("freezes solid the moment it's seen, even in range", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 100, seen: true }));
    expect(s.current).toBe(StalkerState.Frozen);
  });

  it("resumes creeping the instant it's no longer seen", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 100, seen: true }));
    s.update(0.1, P({ distanceToPlayer: 100, seen: false }));
    expect(s.current).toBe(StalkerState.Creeping);
  });

  it("lunges when it closes to grab range while unseen", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 100 }));
    s.update(0.1, P({ distanceToPlayer: 10 }));
    expect(s.current).toBe(StalkerState.Lunging);
  });

  it("lunges immediately if the player looks away while already in grab range", () => {
    const s = new StalkerAI();
    // Seen at point-blank range: frozen, not lunging, however close.
    s.update(0.1, P({ distanceToPlayer: 5, seen: true }));
    expect(s.current).toBe(StalkerState.Frozen);
    // Look away for one tick and it grabs immediately.
    s.update(0.1, P({ distanceToPlayer: 5, seen: false }));
    expect(s.current).toBe(StalkerState.Lunging);
  });

  it("never lunges while it remains seen, no matter how long", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 5, seen: true }));
    s.update(5, P({ distanceToPlayer: 5, seen: true }));
    s.update(50, P({ distanceToPlayer: 5, seen: true }));
    expect(s.current).toBe(StalkerState.Frozen);
  });

  it("retreats after the lunge holds for its duration, then re-lurks after cooldown", () => {
    const s = new StalkerAI({
      ...DEFAULT_STALKER_CONFIG,
      lungeDuration: 0.5,
      retreatCooldown: 1,
    });
    s.update(0.1, P({ distanceToPlayer: 100 }));
    s.update(0.1, P({ distanceToPlayer: 10 }));
    expect(s.current).toBe(StalkerState.Lunging);

    s.update(0.6, P({ distanceToPlayer: 10 }));
    expect(s.current).toBe(StalkerState.Retreating);

    s.update(0.5, P({ distanceToPlayer: 10 }));
    expect(s.current).toBe(StalkerState.Retreating);
    s.update(0.6, P({ distanceToPlayer: 10 }));
    expect(s.current).toBe(StalkerState.Lurking);
  });

  it("resets to lurking", () => {
    const s = new StalkerAI();
    s.update(0.1, P({ distanceToPlayer: 10 }));
    s.reset();
    expect(s.current).toBe(StalkerState.Lurking);
  });
});
