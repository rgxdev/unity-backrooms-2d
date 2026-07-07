import { z } from "zod";

export const SaveGameSchema = z.object({
  version: z.literal(1),
  levelId: z.string().min(1).max(64),
  player: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  discoveredZones: z.array(z.string().min(1).max(64)),
  updatedAt: z.number().int().nonnegative(),
});

export type SaveGame = z.infer<typeof SaveGameSchema>;

export function createNewSave(levelId: string, x: number, y: number): SaveGame {
  return {
    version: 1,
    levelId,
    player: { x, y },
    discoveredZones: [],
    updatedAt: Date.now(),
  };
}

export function parseSaveGame(input: unknown): SaveGame | null {
  const result = SaveGameSchema.safeParse(input);
  return result.success ? result.data : null;
}
