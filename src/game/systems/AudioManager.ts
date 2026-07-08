import type Phaser from "phaser";
import { FEAR } from "@/game/config/constants";
import { getSettings, subscribeSettings } from "@/lib/settings-store";
import type { Settings } from "@/lib/schemas/settings";
import {
  getAllCustomSounds,
  subscribeCustomSounds,
  type SoundSlot,
} from "@/lib/custom-sounds-store";
import { FEATURES } from "@/lib/feature-flags";

/**
 * Bridges app settings to the Phaser sound system and synthesises the monster
 * cues procedurally via the WebAudio context (no sample assets yet). Falls back
 * to silence gracefully when WebAudio is unavailable (HTML5 audio / muted).
 *
 * Any cue can be overridden by a player-imported MP3 (see
 * `@/lib/custom-sounds-store`) — each public cue method checks
 * {@link playCustom} first and only falls through to its synthesised version
 * when no custom sound is loaded for that slot.
 */
export class AudioManager {
  private unsubscribe: (() => void) | null = null;
  private unsubscribeCustomSounds: (() => void) | null = null;
  private masterVolume = 1;
  private heartbeatArmed = false;
  private heartbeatNextAt = 0;
  private humNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  private customBuffers = new Map<SoundSlot, AudioBuffer>();

  constructor(private readonly sound: Phaser.Sound.BaseSoundManager) {
    this.apply(getSettings());
    this.unsubscribe = subscribeSettings((s) => this.apply(s));
    if (FEATURES.customSoundEffects) {
      void this.reloadCustomSounds();
      this.unsubscribeCustomSounds = subscribeCustomSounds(() => {
        void this.reloadCustomSounds();
      });
    }
  }

  /** Decodes every stored custom MP3 into an AudioBuffer ready for instant
   *  playback — re-run whenever the settings page saves/clears one. */
  private async reloadCustomSounds(): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    const blobs = await getAllCustomSounds();
    const next = new Map<SoundSlot, AudioBuffer>();
    for (const [slot, blob] of Object.entries(blobs) as [SoundSlot, Blob][]) {
      try {
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        next.set(slot, buffer);
      } catch {
        // Corrupt/unsupported file — that slot just stays on the synth cue.
      }
    }
    this.customBuffers = next;
  }

  /** Plays the player-imported MP3 for `slot`, if any. Returns whether it
   *  fired, so callers can skip their synthesised fallback. */
  private playCustom(slot: SoundSlot, pan = 0, volumeScale = 1): boolean {
    if (!FEATURES.customSoundEffects) return false;
    const ctx = this.context;
    const buffer = this.customBuffers.get(slot);
    if (!ctx || !buffer || this.masterVolume <= 0) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.0001, this.masterVolume * volumeScale);
    src.connect(gain);
    this.connectOut(gain, ctx, pan);
    src.start();
    return true;
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
    if (this.playCustom("growl", pan, intensity)) return;
    this.tone(72, 0.7, intensity, "sawtooth", pan);
    this.tone(48, 0.9, intensity * 0.7, "sine", pan);
  }

  /** Two sharp barks into a snarl tail — the Hound's noise-drawn presence
   *  cue. Distinct from {@link growl}'s low sustained rumble: percussive and
   *  canine rather than an ambient drone. */
  bark(intensity = 0.4, pan = 0): void {
    if (this.playCustom("bark", pan, intensity)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    let t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.09);
      const peak = Math.max(0.0001, intensity * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain);
      this.connectOut(gain, ctx, pan);
      osc.start(t);
      osc.stop(t + 0.12);
      t += 0.14;
    }
    this.noiseBurst(0.15, intensity * 0.5, 2000, pan);
  }

  /** Loud, close awakening roar when the chase begins. */
  roar(): void {
    if (this.playCustom("roar")) return;
    this.tone(90, 1.1, 0.6, "sawtooth");
    this.tone(140, 0.5, 0.4, "square");
  }

  /** Sharp, high stinger — the "something just flashed into view" jump-scare
   *  cue. Distinct from the low ambient growl and the pursuer's roar. */
  shriek(intensity = 0.4, pan = 0): void {
    if (this.playCustom("shriek", pan, intensity)) return;
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
    if (this.playCustom("whisper", 0, 0.6)) return;
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

  /** Three deliberate, evenly-spaced raps from inside a wall — too regular
   *  to be settling pipes, too patient to be an accident. `pan` (-1..1)
   *  places which side of you the wall is on. */
  knock(pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.42;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      const peak = Math.max(0.0001, 0.34 * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      this.connectOut(gain, ctx, pan);
      osc.start(t);
      osc.stop(t + 0.2);
    }
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

  /** A wet, cracking guttural moan drawn out over a second and a half —
   *  something in pain, or pretending to be. Distinct from {@link growl}'s
   *  steady lurking presence: this one wavers, like a throat straining. */
  moan(intensity = 0.4, pan = 0): void {
    if (this.playCustom("moan", pan, intensity)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(85, t0);
    // Wavering pitch — an uneven series of small ramps instead of a clean
    // glide reads as a strained, involuntary sound rather than a synth swell.
    osc.frequency.linearRampToValueAtTime(65, t0 + 0.3);
    osc.frequency.linearRampToValueAtTime(95, t0 + 0.55);
    osc.frequency.linearRampToValueAtTime(55, t0 + 0.9);
    osc.frequency.linearRampToValueAtTime(70, t0 + 1.3);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 1.6);
    const peak = Math.max(0.0001, intensity * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.2);
    gain.gain.setValueAtTime(peak, t0 + 1.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);
    osc.connect(filter).connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(t0 + 1.7);
  }

  /** A dry, wheezing giggle — three to five quick warbling blips that pitch
   *  up and down unevenly. Playful register, wrong context: unsettling
   *  precisely because it sounds amused. Distinct from every scream/growl
   *  cue, which all read as hostile rather than delighted. */
  laugh(intensity = 0.3, pan = 0): void {
    if (this.playCustom("laugh", pan, intensity)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const beats = 3 + Math.floor(Math.random() * 3);
    let t = ctx.currentTime;
    for (let i = 0; i < beats; i++) {
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const base = 300 + Math.random() * 220;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.14);
      const peak = Math.max(0.0001, intensity * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain);
      this.connectOut(gain, ctx, pan);
      osc.start(t);
      osc.stop(t + 0.17);
      t += 0.11 + Math.random() * 0.09;
    }
  }

  /** A single sharp metallic slam — a door, a locker, something heavy
   *  falling out of sight. Transient thump plus a bright noise crack so it
   *  reads as an impact, not a tone. */
  bang(intensity = 0.5, pan = 0): void {
    if (this.playCustom("bang", pan, intensity)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    this.noiseBurst(0.12, intensity, 3200, pan);
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
    const peak = Math.max(0.0001, intensity * 0.8 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  /** Unseen footsteps — three or four dull thuds that grow louder and
   *  closer together, as if approaching from off-screen. Directional via
   *  `pan`; distinct from {@link thud}'s single distant impact. */
  footsteps(pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const steps = 3 + Math.floor(Math.random() * 2);
    let t = ctx.currentTime;
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70 - progress * 15, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);
      const peak = Math.max(
        0.0001,
        (0.12 + progress * 0.22) * this.masterVolume,
      );
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain);
      this.connectOut(gain, ctx, pan);
      osc.start(t);
      osc.stop(t + 0.22);
      t += 0.42 - progress * 0.16 + Math.random() * 0.05;
    }
  }

  /** Close, ragged breathing right at the edge of hearing — as if something
   *  is standing just behind the player. Two-phase inhale/exhale noise
   *  swell, low volume and centred (pan defaults near 0) so it reads as
   *  "right here" rather than off in the dark like {@link murmur}. */
  breath(intensity = 0.22, pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    this.noiseBurst(0.55, intensity, 500, pan);
    const t = ctx.currentTime + 0.5;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(380, t);
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.45));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const peak = Math.max(0.0001, intensity * 0.8 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(filter).connect(gain);
    this.connectOut(gain, ctx, pan);
    src.start(t);
    src.stop(t + 0.5);
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

  /** A long, rising-then-falling howl carried from somewhere else in the
   *  maze — the Hound pack's calling card (see lore.ts). Purely ambient: it
   *  never signals an actual nearby Hound, just that something out there is
   *  hunting. Distinct from {@link distantScream}'s ragged human-adjacent
   *  cry — this one is sustained and tonal, unmistakably animal. */
  howl(pan = 0): void {
    if (this.playCustom("howl", pan, 0.4)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.Q.value = 2;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.4);
    osc.frequency.exponentialRampToValueAtTime(340, t0 + 1.1);
    osc.frequency.exponentialRampToValueAtTime(140, t0 + 1.8);
    const peak = Math.max(0.0001, 0.32 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.35);
    gain.gain.setValueAtTime(peak * 0.8, t0 + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
    osc.connect(filter).connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(t0 + 1.95);
  }

  /** The Skin-Stealer's "you were staring" scare beat: a sibilant hiss
   *  collapsing into a low, descending snarl — deliberately *not* an
   *  ascending shriek like {@link scream}, so it reads as a different threat
   *  noticing you, not a recolor of the Stalker's grab. */
  hiss(intensity = 0.7, pan = 0): void {
    if (this.playCustom("hiss", pan, intensity)) return;
    this.noiseBurst(0.5, intensity * 0.7, 3000, pan);
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.4);
    const peak = Math.max(0.0001, intensity * 0.6 * this.masterVolume);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    this.connectOut(gain, ctx, pan);
    osc.start();
    osc.stop(ctx.currentTime + 0.52);
  }

  /** The Deathmoth's "swarm graze" — several quick, overlapping wing-flutter
   *  blips over a thin noise bed, reading as insect wings brushing past
   *  rather than a growl/bark/hiss. Always a startle, never a threat cue (see
   *  {@link MonsterKindConfig.harmless} in constants.ts). */
  wingBuzz(intensity = 0.4, pan = 0): void {
    if (this.playCustom("wingBuzz", pan, intensity)) return;
    const ctx = this.context;
    if (!ctx || this.masterVolume <= 0) return;
    this.noiseBurst(0.4, intensity * 0.5, 3400, pan);
    let t = ctx.currentTime;
    const blips = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blips; i++) {
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const base = 180 + Math.random() * 90;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 1.3, t + 0.03);
      const peak = Math.max(0.0001, intensity * 0.35 * this.masterVolume);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain);
      this.connectOut(gain, ctx, pan);
      osc.start(t);
      osc.stop(t + 0.06);
      t += 0.045 + Math.random() * 0.03;
    }
  }

  /** The Stalker's lunge: a ragged shriek-into-growl hybrid, close and wet —
   *  distinct from every other cue, reserved for the "don't look away" grab. */
  scream(intensity = 0.75, pan = 0): void {
    if (this.playCustom("scream", pan, intensity)) return;
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
    this.unsubscribeCustomSounds?.();
    this.unsubscribeCustomSounds = null;
  }
}
