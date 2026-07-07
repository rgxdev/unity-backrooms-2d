"use client";

import Link from "next/link";
import { getOfficialLevel } from "@/game/levels/officialLevels";
import { playUiClick } from "@/lib/ui-sound";
import { useProgress } from "./levels/useProgress";
import { useSettings } from "./settings/useSettings";

export default function MainMenu() {
  const { progress } = useProgress();
  const { settings } = useSettings();
  const current = getOfficialLevel(progress.currentLevel);

  return (
    <main className="menu-shell">
      <div style={{ textAlign: "center" }}>
        <h1 className="title">Backrooms</h1>
        <p className="subtitle">
          {current.name.toUpperCase()} · {settings.difficulty.toUpperCase()}
        </p>
      </div>
      <nav className="menu-nav">
        <Link href="/game" className="menu-btn" onClick={playUiClick}>
          Continue
        </Link>
        <Link href="/levels" className="menu-btn" onClick={playUiClick}>
          Level Selection
        </Link>
        <Link href="/settings" className="menu-btn" onClick={playUiClick}>
          Settings
        </Link>
        <Link href="/skins" className="menu-btn" onClick={playUiClick}>
          Skin Selection
        </Link>
        <Link href="/stats" className="menu-btn" onClick={playUiClick}>
          Statistics
        </Link>
        <Link href="/credits" className="menu-btn" onClick={playUiClick}>
          Credits
        </Link>
      </nav>
    </main>
  );
}
