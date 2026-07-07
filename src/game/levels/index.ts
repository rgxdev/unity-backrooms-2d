import type { LevelData } from "@/lib/schemas/level";
import { LEVEL_00 } from "./level-00";

const REGISTRY: Record<string, LevelData> = {
  [LEVEL_00.id]: LEVEL_00,
};

export const FIRST_LEVEL_ID = LEVEL_00.id;

export function getLevel(id: string): LevelData | null {
  return REGISTRY[id] ?? null;
}

export function listLevels(): readonly LevelData[] {
  return Object.values(REGISTRY);
}
