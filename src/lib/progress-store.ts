import {
  DEFAULT_PROGRESS,
  parseProgress,
  type Progress,
} from "@/lib/schemas/progress";
import { readJson, writeJson } from "@/lib/storage";
import { LAST_LEVEL_INDEX } from "@/game/levels/officialLevels";
import { SKINS } from "@/game/skins/skinCatalog";

const STORAGE_KEY = "backrooms.progress.v1";

type Listener = (progress: Progress) => void;

let current: Progress = DEFAULT_PROGRESS;
let hydrated = false;
const listeners = new Set<Listener>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  current = parseProgress(readJson(STORAGE_KEY));
  hydrated = true;
}

function commit(next: Progress): Progress {
  current = parseProgress(next);
  writeJson(STORAGE_KEY, current);
  for (const listener of listeners) listener(current);
  return current;
}

export function getProgress(): Progress {
  hydrate();
  return current;
}

export function subscribeProgress(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Set the level to play next, if it has been unlocked. */
export function selectLevel(index: number): Progress {
  hydrate();
  if (!current.unlocked.includes(index)) return current;
  return commit({ ...current, currentLevel: index });
}

/**
 * Mark a level as beaten: unlock the next one and make it current, and
 * unlock that level's reward skin if it has one. Clamped to the last
 * official level.
 */
export function completeLevel(index: number): Progress {
  hydrate();
  const next = Math.min(index + 1, LAST_LEVEL_INDEX);
  const unlocked = Array.from(new Set([...current.unlocked, next])).sort(
    (a, b) => a - b,
  );
  const rewardSkin = SKINS.find((skin) => skin.unlockLevel === index);
  const unlockedSkins = rewardSkin
    ? Array.from(new Set([...current.unlockedSkins, rewardSkin.id]))
    : current.unlockedSkins;
  return commit({ ...current, currentLevel: next, unlocked, unlockedSkins });
}
