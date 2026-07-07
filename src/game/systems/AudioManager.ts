import type Phaser from "phaser";
import { getSettings, subscribeSettings } from "@/lib/settings-store";
import type { Settings } from "@/lib/schemas/settings";

/**
 * Bridges app settings to the Phaser sound system. Music/SFX assets are added
 * in a later milestone; this establishes the volume wiring and lifecycle so
 * that work slots in without touching the scene.
 */
export class AudioManager {
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly sound: Phaser.Sound.BaseSoundManager) {
    this.apply(getSettings());
    this.unsubscribe = subscribeSettings((s) => this.apply(s));
  }

  private apply(settings: Settings): void {
    this.sound.volume = settings.masterVolume;
    this.sound.mute = settings.masterVolume <= 0;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
