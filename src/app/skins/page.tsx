"use client";

import Link from "next/link";
import { isSkinUnlocked, SKINS } from "@/game/skins/skinCatalog";
import { getOfficialLevel } from "@/game/levels/officialLevels";
import { playUiClick } from "@/lib/ui-sound";
import { useProgress } from "../levels/useProgress";
import { useSettings } from "../settings/useSettings";
import { SkinPreview } from "./SkinPreview";

export default function SkinsPage() {
  const { progress } = useProgress();
  const { settings, update } = useSettings();

  return (
    <main className="page">
      <h1>Skin Selection</h1>
      <p className="hint">
        Escape a level to unlock its reward gear. The wardrobe set — who you
        were before you noclipped — is always available. Equip a skin here
        and it carries into every run.
      </p>
      <div className="skin-grid">
        {SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, progress.unlockedSkins);
          const equipped = settings.skinId === skin.id;
          const lockedHint =
            skin.unlockLevel !== undefined
              ? `Locked — escape ${getOfficialLevel(skin.unlockLevel).name}.`
              : null;
          return (
            <button
              key={skin.id}
              type="button"
              className={`skin-card${equipped ? " skin-card--equipped" : ""}${
                unlocked ? "" : " skin-card--locked"
              }`}
              disabled={!unlocked}
              onClick={() => {
                playUiClick();
                update({ skinId: skin.id });
              }}
            >
              <SkinPreview skin={skin} />
              <span className="skin-card__name">
                {skin.name}
                {equipped && <span className="tag">equipped</span>}
                {!unlocked && <span className="level-card__lock"> 🔒</span>}
              </span>
              <span className="skin-card__blurb">
                {unlocked ? skin.description : lockedHint}
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
