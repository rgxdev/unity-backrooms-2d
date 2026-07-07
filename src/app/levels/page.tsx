"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OFFICIAL_LEVELS } from "@/game/levels/officialLevels";
import { playUiClick } from "@/lib/ui-sound";
import { useProgress } from "./useProgress";

export default function LevelsPage() {
  const router = useRouter();
  const { progress, select } = useProgress();

  function play(index: number) {
    playUiClick();
    select(index);
    router.push("/game");
  }

  return (
    <main className="page">
      <h1>Level Selection</h1>
      <p className="hint">
        Beat a level to unlock the next. Unlocked levels can be replayed — every
        run generates a fresh random layout.
      </p>

      <div className="level-list">
        {OFFICIAL_LEVELS.map((level) => {
          const unlocked = progress.unlocked.includes(level.index);
          const current = progress.currentLevel === level.index;
          return (
            <button
              key={level.id}
              className={`level-card${current ? " level-card--current" : ""}`}
              disabled={!unlocked}
              onClick={() => play(level.index)}
            >
              <span className="level-card__name">
                {level.name}
                {!unlocked && <span className="level-card__lock"> 🔒</span>}
                {current && <span className="tag">current</span>}
              </span>
              <span className="level-card__blurb">
                {unlocked ? level.blurb : "Locked — escape the previous level."}
              </span>
            </button>
          );
        })}
      </div>

      <Link href="/" className="back-link" onClick={playUiClick}>
        &larr; Back to menu
      </Link>
    </main>
  );
}
