import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("returns defaults for invalid input", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ masterVolume: 5 })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid overrides", () => {
    const parsed = parseSettings({
      ...DEFAULT_SETTINGS,
      masterVolume: 0.25,
      showFps: true,
    });
    expect(parsed.masterVolume).toBe(0.25);
    expect(parsed.showFps).toBe(true);
  });

  it("clamps out-of-range volumes to defaults", () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, sfxVolume: -1 })).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});
