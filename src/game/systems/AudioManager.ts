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
  private humNodes: { osc: OscillatorNode; gain: GainNode } | null = null;

  constructor(private readonly sound: Phaser.Sound.BaseSoundManager) {
    this.apply(getSettings());
    this.unsubscribe = subscribeSettings((s) => this.apply(s));
  }

  private apply(settings: Settings): void {
    this.masterVolume = settings.masterVolume;
    this.sound.volume = settings.masterVolume;
    this.sound.mute = settings.masterVolume <= 0;
    if (this.humNodes) {
      this.humNodes.gain.gain.setTargetAtTime(
        this.humTargetGain(),
        this.context?.currentTime ?? 0,
        0.3,
      );
    }
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

  private humTargetGain(): number {
    return Math.max(0.0001, 0.05 * this.masterVolume);
  }

  /**
   * The fluorescent-light drone that never stops — Backrooms signature
   * ambience. Starts a looping low-frequency oscillator; idempotent, so it's
   * safe to call once per scene without tracking start state elsewhere.
   */
  startHum(): void {
    if (this.humNodes) return;
    const ctx = this.context;
    if (!ctx) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    gain.gain.setValueAtTime(this.humTargetGain(), ctx.currentTime);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this.humNodes = { osc, gain };
  }

  stopHum(): void {
    if (!this.humNodes) return;
    const { osc, gain } = this.humNodes;
    const ctx = this.context;
    if (ctx) {
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      osc.stop(ctx.currentTime + 0.6);
    } else {
      osc.stop();
    }
    this.humNodes = null;
  }

  /** Electrical stutter — a light flickering overhead. */
  flicker(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    const peak = Math.max(0.0001, 0.18 * this.masterVolume);
    // Three short crackling pulses instead of one smooth tone.
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    }
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /** A low, garbled murmur just at the edge of hearing — no one there. */
  whisper(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.value = 4;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 1.2);
    const peak = Math.max(0.0001, 0.12 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.3);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.35);
  }

  /** Distant, heavy thud — something moved somewhere out of sight. */
  thud(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.4);
    const peak = Math.max(0.0001, 0.3 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }

  /** Bright ascending chime — reward feedback (e.g. a skin unlock). */
  chime(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const notes = [660, 880, 1100];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      const peak = Math.max(0.0001, 0.22 * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  destroy(): void {
    this.stopHum();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
