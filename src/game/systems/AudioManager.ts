import type Phaser from "phaser";
import { getSettings, subscribeSettings } from "@/lib/settings-store";
import type { Settings } from "@/lib/schemas/settings";

/**
 * Bridges app settings to the Phaser sound system and synthesises the monster
 * cues procedurally via the WebAudio context (no sample assets yet). Falls back
 * to silence gracefully when WebAudio is unavailable (HTML5 audio / muted).
 */
export class AudioManager {
  private unsubscribe: (() => void) | null = null;
  private masterVolume = 1;

  constructor(private readonly sound: Phaser.Sound.BaseSoundManager) {
    this.apply(getSettings());
    this.unsubscribe = subscribeSettings((s) => this.apply(s));
  }

  private apply(settings: Settings): void {
    this.masterVolume = settings.masterVolume;
    this.sound.volume = settings.masterVolume;
    this.sound.mute = settings.masterVolume <= 0;
  }

  private get context(): AudioContext | null {
    const mgr = this.sound as Phaser.Sound.BaseSoundManager & {
      context?: AudioContext;
    };
    return mgr.context ?? null;
  }

  /**
   * A short low tone with an exponential decay. Used to build the monster's
   * ambient rumble and its awakening roar.
   */
  private tone(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
  ): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    // Slight downward glide gives the tone a growl-like fall.
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * 0.6),
      ctx.currentTime + duration,
    );
    const peak = Math.max(0.0001, volume * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  /** Distant, muffled presence — "you can hear something nearby". */
  growl(intensity = 0.35): void {
    this.tone(72, 0.7, intensity, "sawtooth");
    this.tone(48, 0.9, intensity * 0.7, "sine");
  }

  /** Loud, close awakening roar when the chase begins. */
  roar(): void {
    this.tone(90, 1.1, 0.6, "sawtooth");
    this.tone(140, 0.5, 0.4, "square");
  }

  /** Sharp, high stinger — the "something just flashed into view" jump-scare
   *  cue. Distinct from the low ambient growl and the pursuer's roar. */
  shriek(intensity = 0.4): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    // Upward glide (the inverse of tone()'s growl-fall) reads as a sudden
    // shock rather than a lurking rumble.
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    const peak = Math.max(0.0001, intensity * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  /** Close, snapping attack bite — the jump-scare's lunge, distinct from the
   *  pursuer's sustained roar. */
  snarl(): void {
    this.tone(220, 0.3, 0.55, "square");
    this.tone(90, 0.4, 0.5, "sawtooth");
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
