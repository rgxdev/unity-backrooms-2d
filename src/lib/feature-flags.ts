/**
 * Static frontend feature toggles. Flip a flag here to show/hide an optional
 * feature everywhere it's wired up, without touching the pages/systems that
 * consume it. Plain build-time constants, not per-user settings — for
 * per-user preferences use `@/lib/settings-store` instead.
 */
export const FEATURES = {
  /** Settings page "Custom Sound Effects" (MP3 import) section, and
   *  AudioManager's use of any sounds already imported through it. */
  customSoundEffects: true,
} as const;
