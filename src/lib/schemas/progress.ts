import { z } from "zod";

export const ProgressSchema = z.object({
  version: z.literal(1),
  /** Level index the player is currently on / will start. */
  currentLevel: z.number().int().nonnegative(),
  /** Level indices unlocked for replay from the level-select menu. */
  unlocked: z.array(z.number().int().nonnegative()),
});

export type Progress = z.infer<typeof ProgressSchema>;

export const DEFAULT_PROGRESS: Progress = {
  version: 1,
  currentLevel: 0,
  unlocked: [0],
};

export function parseProgress(input: unknown): Progress {
  const result = ProgressSchema.safeParse(input);
  return result.success ? result.data : DEFAULT_PROGRESS;
}
