import { z } from "zod";

export const StatsSchema = z.object({
  version: z.literal(1),
  runsStarted: z.number().int().nonnegative(),
  escapes: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  falls: z.number().int().nonnegative(),
  /** Accumulated time across every run, in milliseconds. */
  playTimeMs: z.number().nonnegative(),
});

export type Stats = z.infer<typeof StatsSchema>;

export const DEFAULT_STATS: Stats = {
  version: 1,
  runsStarted: 0,
  escapes: 0,
  deaths: 0,
  falls: 0,
  playTimeMs: 0,
};

export function parseStats(input: unknown): Stats {
  const result = StatsSchema.safeParse(input);
  return result.success ? result.data : DEFAULT_STATS;
}
