import { describe, expect, it } from "vitest";
import {
  DEFAULT_SKINSTEALER_CONFIG,
  SkinStealerAI,
  SkinStealerState,
} from "./SkinStealerAI";

const P = (gazed = false) => ({ gazed });

describe("SkinStealerAI", () => {
  it("starts docile", () => {
    expect(new SkinStealerAI().current).toBe(SkinStealerState.Docile);
  });

  it("stays docile under brief/no gaze", () => {
    const s = new SkinStealerAI();
    s.update(0.5, P(false));
    s.update(0.1, P(true));
    expect(s.current).toBe(SkinStealerState.Docile);
  });

  it("lunges once continuous gaze reaches the threshold", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
    });
    s.update(0.6, P(true));
    expect(s.current).toBe(SkinStealerState.Docile);
    s.update(0.5, P(true));
    expect(s.current).toBe(SkinStealerState.Lunging);
  });

  it("never lunges if gaze is broken before the threshold", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
    });
    s.update(0.6, P(true));
    s.update(0.1, P(false)); // looked away — resets the count
    s.update(0.6, P(true));
    expect(s.current).toBe(SkinStealerState.Docile);
  });

  it("requires continuous, not cumulative, gaze", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
    });
    // Several short glances summing past the threshold, each broken by a
    // look-away, must never trigger it.
    for (let i = 0; i < 5; i++) {
      s.update(0.4, P(true));
      s.update(0.1, P(false));
    }
    expect(s.current).toBe(SkinStealerState.Docile);
  });

  it("retreats after the lunge holds for its duration, then goes docile again after cooldown", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
      lungeDuration: 0.5,
      retreatCooldown: 1,
    });
    s.update(1, P(true));
    expect(s.current).toBe(SkinStealerState.Lunging);

    s.update(0.6, P(true));
    expect(s.current).toBe(SkinStealerState.Retreating);

    s.update(0.5, P(true));
    expect(s.current).toBe(SkinStealerState.Retreating);
    s.update(0.6, P(true));
    expect(s.current).toBe(SkinStealerState.Docile);
  });

  it("cannot be re-triggered while retreating, even under continuous gaze", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
      lungeDuration: 0.5,
      retreatCooldown: 5,
    });
    s.update(1, P(true));
    s.update(0.6, P(true));
    expect(s.current).toBe(SkinStealerState.Retreating);
    // Still well under the 5s retreat cooldown.
    s.update(2, P(true));
    expect(s.current).toBe(SkinStealerState.Retreating);
  });

  it("resets to docile", () => {
    const s = new SkinStealerAI({
      ...DEFAULT_SKINSTEALER_CONFIG,
      gazeThreshold: 1,
    });
    s.update(1, P(true));
    s.update(0.5, P(true));
    expect(s.current).toBe(SkinStealerState.Lunging);
    s.reset();
    expect(s.current).toBe(SkinStealerState.Docile);
  });
});
