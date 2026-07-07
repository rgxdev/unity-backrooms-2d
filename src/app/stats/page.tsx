"use client";

import Link from "next/link";
import { OFFICIAL_LEVELS } from "@/game/levels/officialLevels";
import { SKINS } from "@/game/skins/skinCatalog";
import { playUiClick } from "@/lib/ui-sound";
import { useProgress } from "../levels/useProgress";
import { useStats } from "./useStats";

function formatPlayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

export default function StatsPage() {
  const stats = useStats();
  const { progress } = useProgress();
  const escapeRate =
    stats.runsStarted > 0
      ? Math.round((stats.escapes / stats.runsStarted) * 100)
      : 0;

  return (
    <main className="page">
      <h1>Statistics</h1>
      <p className="hint">Everything tracked since your first descent.</p>

      <div className="stat-grid">
        <StatTile label="Runs Started" value={String(stats.runsStarted)} />
        <StatTile label="Escapes" value={String(stats.escapes)} />
        <StatTile label="Deaths" value={String(stats.deaths)} />
        <StatTile label="Falls" value={String(stats.falls)} />
        <StatTile label="Escape Rate" value={`${escapeRate}%`} />
        <StatTile
          label="Total Playtime"
          value={formatPlayTime(stats.playTimeMs)}
        />
        <StatTile
          label="Levels Unlocked"
          value={`${progress.unlocked.length} / ${OFFICIAL_LEVELS.length}`}
        />
        <StatTile
          label="Skins Unlocked"
          value={`${progress.unlockedSkins.length} / ${SKINS.length}`}
        />
      </div>

      <Link href="/" className="back-link" onClick={playUiClick}>
        &larr; Back to menu
      </Link>
    </main>
  );
}
