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

  /** Electrical stutter — a light flickering overhead. Pulse count and
   *  timing are randomised each call so no two flickers sound alike — an
   *  old dying tube stuttering unevenly, not a metronome. */
  flicker(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    const peak = Math.max(0.0001, 0.18 * this.masterVolume);
    const pulses = 2 + Math.floor(Math.random() * 4);
    let t = ctx.currentTime;
    for (let i = 0; i < pulses; i++) {
      t += 0.05 + Math.random() * 0.08;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    }
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(t + 0.4);
  }

  /** A low, garbled murmur just at the edge of hearing — no one there.
   *  ProcessDirector's ambient anomaly cue (no direction; always distant). */
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

  /** Bright ascending three-note chime — reward feedback for a skin unlock,
   *  distinct from {@link chime}'s two-note Almond Water pickup jingle. */
  skinUnlockChime(): void {
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

  /** Barely-there murmur in the dark, distinct from {@link whisper} — a
   *  directional cue tied to a specific unseen encounter rather than
   *  ProcessDirector's undirected ambient anomaly. Pure unease; never tied
   *  to a visible threat. */
  murmur(intensity = 0.2): void {
    const pan = Math.random() * 2 - 1;
    this.noiseBurst(0.9, intensity * 0.5, 700, pan);
    this.tone(190, 0.8, intensity * 0.4, "sine", pan);
  }

  /** The power gutters — a dry electrical crackle under the blackout flicker,
   *  distinct from {@link flicker}'s light-stutter crackle. */
  staticBurst(intensity = 0.35): void {
    this.noiseBurst(0.22, intensity, 2600);
    this.tone(60, 0.25, intensity * 0.5, "sawtooth");
  }

  /** Harsh burst of TV static — the "static" ambient anomaly's crackle.
   *  Broader-band and brighter than {@link staticBurst}'s power-gutter hiss;
   *  reads as a signal dropping out, not the lights guttering. */
  staticFuzz(): void {
    this.noiseBurst(0.18, 0.3, 4200);
    this.noiseBurst(0.12, 0.22, 900);
  }

  /** Far-off, muffled scream — something else is out there, always at a
   *  random pan since it's never tied to a visible threat. Distinct from
   *  {@link scream}'s close, loud "don't look away" grab: heavily filtered,
   *  quieter, and drawn out instead of a sharp jolt. */
  distantScream(pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.Q.value = 1.2;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.9);
    const peak = Math.max(0.0001, 0.28 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
    osc.connect(filter).connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + 1.05);
    this.noiseBurst(0.5, 0.12, 1400, pan);
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

  /** Bright ascending two-note chime — picking up a bottle of Almond Water. */
  chime(): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    for (const [freq, delay] of [
      [660, 0],
      [990, 0.08],
    ] as const) {
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const start = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, start);
      const peak = Math.max(0.0001, 0.35 * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.37);
    }
  }

  destroy(): void {
    this.stopHum();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
