"use client";

import Link from "next/link";
import { DIFFICULTIES } from "@/lib/schemas/settings";
import { SOUND_SLOTS, type SoundSlot } from "@/lib/custom-sounds-store";
import { FEATURES } from "@/lib/feature-flags";
import { useSettings } from "./useSettings";
import { useCustomSounds } from "./useCustomSounds";

const DIFFICULTY_LABEL: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "Easy — no death, calm dread",
  middle: "Middle — the monster can kill",
  hard: "Hard — bigger, deadlier",
};

function VolumeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function SoundSlotRow({
  id,
  label,
  isCustom,
  onUpload,
  onReset,
}: {
  id: SoundSlot;
  label: string;
  isCustom: boolean;
  onUpload: (file: File) => void;
  onReset: () => void;
}) {
  const inputId = `sound-slot-${id}`;
  return (
    <div className="sound-slot">
      <div className="sound-slot__info">
        <label htmlFor={inputId}>{label}</label>
        <span className={`sound-slot__badge${isCustom ? " sound-slot__badge--on" : ""}`}>
          {isCustom ? "custom" : "default"}
        </span>
      </div>
      <div className="sound-slot__actions">
        <input
          id={inputId}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/*,.mp3"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        {isCustom && (
          <button type="button" className="sound-slot__reset" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { active, upload, reset } = useCustomSounds();

  return (
    <main className="page">
      <h1>Settings</h1>

      <div className="field field--stack">
        <label>Difficulty</label>
        <div className="segmented" role="group" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`seg-btn${settings.difficulty === d ? " seg-btn--on" : ""}`}
              aria-pressed={settings.difficulty === d}
              onClick={() => update({ difficulty: d })}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="hint">{DIFFICULTY_LABEL[settings.difficulty]}</p>
      </div>

      <VolumeField
        label="Master Volume"
        value={settings.masterVolume}
        onChange={(v) => update({ masterVolume: v })}
      />
      <VolumeField
        label="Music Volume"
        value={settings.musicVolume}
        onChange={(v) => update({ musicVolume: v })}
      />
      <VolumeField
        label="SFX Volume"
        value={settings.sfxVolume}
        onChange={(v) => update({ sfxVolume: v })}
      />

      <div className="field">
        <label htmlFor="show-fps">Show FPS</label>
        <input
          id="show-fps"
          type="checkbox"
          checked={settings.showFps}
          onChange={(e) => update({ showFps: e.target.checked })}
        />
      </div>

      {FEATURES.customSoundEffects && (
        <div className="field field--stack">
          <label>Custom Sound Effects</label>
          <p className="hint">
            Replace any scare cue with your own audio file — stored only in
            this browser, never uploaded anywhere. Leave a slot on "default"
            to keep the built-in synthesised sound.
          </p>
          <div className="sound-slot-list">
            {SOUND_SLOTS.map((slot) => (
              <SoundSlotRow
                key={slot.id}
                id={slot.id}
                label={slot.label}
                isCustom={active.has(slot.id)}
                onUpload={(file) => upload(slot.id, file)}
                onReset={() => reset(slot.id)}
              />
            ))}
          </div>
        </div>
      )}

      <Link href="/" className="back-link">
        &larr; Back to menu
      </Link>
    </main>
  );
}
