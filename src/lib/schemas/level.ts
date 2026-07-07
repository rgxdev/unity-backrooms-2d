import { z } from "zod";

export const TileKind = {
  Floor: 0,
  Wall: 1,
} as const;

export const ZoneSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hidden: z.boolean().default(false),
});

export const LevelSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(128),
    tileSize: z.number().int().positive().max(256),
    width: z.number().int().positive().max(512),
    height: z.number().int().positive().max(512),
    tiles: z.array(z.number().int().min(0).max(1)),
    spawn: z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
    }),
    zones: z.array(ZoneSchema).default([]),
  })
  .superRefine((level, ctx) => {
    if (level.tiles.length !== level.width * level.height) {
      ctx.addIssue({
        code: "custom",
        message: `tiles length ${level.tiles.length} != width*height ${
          level.width * level.height
        }`,
        path: ["tiles"],
      });
    }
    if (level.spawn.x >= level.width || level.spawn.y >= level.height) {
      ctx.addIssue({
        code: "custom",
        message: "spawn is outside level bounds",
        path: ["spawn"],
      });
    }
  });

export type Zone = z.infer<typeof ZoneSchema>;
export type LevelData = z.infer<typeof LevelSchema>;

export function parseLevel(input: unknown): LevelData {
  return LevelSchema.parse(input);
}
