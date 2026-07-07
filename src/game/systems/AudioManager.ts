import type Phaser from "phaser";
import { FEAR } from "@/game/config/constants";
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
  private heartbeatArmed = false;
  private heartbeatNextAt = 0;

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

  /** Route a source through an optional stereo panner (-1 left .. 1 right)
   *  before the destination, so cues can hint at the threat's direction. */
  private connectOut(node: AudioNode, ctx: AudioContext, pan: number): void {
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(
        Math.max(-1, Math.min(1, pan)),
        ctx.currentTime,
      );
      node.connect(panner).connect(ctx.destination);
    } else {
      node.connect(ctx.destination);
    }
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
    pan = 0,
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
    osc.connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  /** A burst of filtered white noise — texture for statics, whispers and the
   *  Stalker's scream that a pure tone can't sell. */
  private noiseBurst(
    duration: number,
    volume: number,
    filterFreq = 1200,
    pan = 0,
  ): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
    const gain = ctx.createGain();
    const peak = Math.max(0.0001, volume * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter).connect(gain);
    this.connectOut(gain, ctx, pan);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
  }

  /** Distant, muffled presence — "you can hear something nearby".
   *  `pan` (-1..1) hints at which side it's on. */
  growl(intensity = 0.35, pan = 0): void {
    this.tone(72, 0.7, intensity, "sawtooth", pan);
    this.tone(48, 0.9, intensity * 0.7, "sine", pan);
  }

  /** Loud, close awakening roar when the chase begins. */
  roar(): void {
    this.tone(90, 1.1, 0.6, "sawtooth");
    this.tone(140, 0.5, 0.4, "square");
  }

  /** Sharp, high stinger — the "something just flashed into view" jump-scare
   *  cue. Distinct from the low ambient growl and the pursuer's roar. */
  shriek(intensity = 0.4, pan = 0): void {
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
    osc.connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  /** Close, snapping attack bite — the jump-scare's lunge, distinct from the
   *  pursuer's sustained roar. */
  snarl(): void {
    this.tone(220, 0.3, 0.55, "square");
    this.tone(90, 0.4, 0.5, "sawtooth");
  }

  /** Barely-there murmur in the dark — no source, no direction you can pin
   *  down. Pure unease; never tied to a visible threat. */
  whisper(intensity = 0.2): void {
    const pan = Math.random() * 2 - 1;
    this.noiseBurst(0.9, intensity * 0.5, 700, pan);
    this.tone(190, 0.8, intensity * 0.4, "sine", pan);
  }

  /** The power gutters — a dry electrical crackle under the blackout flicker. */
  staticBurst(intensity = 0.35): void {
    this.noiseBurst(0.22, intensity, 2600);
    this.tone(60, 0.25, intensity * 0.5, "sawtooth");
  }

  /** The Stalker's lunge: a ragged shriek-into-growl hybrid, close and wet —
   *  distinct from every other cue, reserved for the "don't look away" grab. */
  scream(intensity = 0.75, pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.16);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.42);
    const peak = Math.max(0.0001, intensity * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.46);
    osc.connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    this.noiseBurst(0.35, intensity * 0.6, 1800, pan);
    this.tone(80, 0.5, intensity * 0.5, "sawtooth", pan);
  }

  /**
   * Drives the heartbeat cue from a 0..1 fear value — the interval shrinks
   * and the thump gets louder the more dread is in the air. Call every
   * frame; internally throttled to the beat interval.
   */
  updateHeartbeat(fear: number, time: number): void {
    const level = Math.max(0, Math.min(1, fear));
    if (level <= 0.03) {
      this.heartbeatArmed = false;
      return;
    }
    if (!this.heartbeatArmed) {
      this.heartbeatArmed = true;
      this.heartbeatNextAt = time;
    }
    if (time < this.heartbeatNextAt) return;
    const interval =
      FEAR.heartbeatMaxIntervalMs -
      level * (FEAR.heartbeatMaxIntervalMs - FEAR.heartbeatMinIntervalMs);
    this.heartbeatNextAt = time + interval;
    this.tone(50, 0.1, 0.12 + level * 0.32, "sine");
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
