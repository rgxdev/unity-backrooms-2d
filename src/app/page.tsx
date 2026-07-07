"use client";

import Link from "next/link";
import { getOfficialLevel } from "@/game/levels/officialLevels";
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
        <Link href="/game" className="menu-btn">
          Continue
        </Link>
        <Link href="/levels" className="menu-btn">
          Level Selection
        </Link>
        <Link href="/settings" className="menu-btn">
          Settings
        </Link>
        <Link href="/skins" className="menu-btn">
          Skin Selection
          <span className="tag">soon</span>
        </Link>
        <Link href="/credits" className="menu-btn">
          Credits
        </Link>
      </nav>
    </main>
  );
}
