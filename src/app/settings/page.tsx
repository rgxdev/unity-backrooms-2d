"use client";

import Link from "next/link";
import { DIFFICULTIES } from "@/lib/schemas/settings";
import { useSettings } from "./useSettings";

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

export default function SettingsPage() {
  const { settings, update } = useSettings();

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

      <Link href="/" className="back-link">
        &larr; Back to menu
      </Link>
    </main>
  );
}
