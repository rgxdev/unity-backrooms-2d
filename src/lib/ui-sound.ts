import { getSettings } from "@/lib/settings-store";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return null;
  ctx ??= new AudioCtor();
  return ctx;
}

/** Soft two-tone blip for menu navigation — the same synth style as the
 *  in-game AudioManager, but for React-side UI outside the Phaser canvas. */
export function playUiClick(): void {
  const settings = getSettings();
  const volume = settings.masterVolume * settings.sfxVolume;
  if (volume <= 0) return;
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") void audioCtx.resume();

  const gain = audioCtx.createGain();
  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(520, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(760, audioCtx.currentTime + 0.06);
  const peak = Math.max(0.0001, 0.18 * volume);
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(peak, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.14);
}
