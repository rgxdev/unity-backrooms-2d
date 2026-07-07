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

export const PointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const MonsterSpawnSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  /** Looping patrol waypoints in tile coordinates. Empty = stationary. */
  patrol: z.array(PointSchema).default([]),
});

export const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
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
    monsters: z.array(MonsterSpawnSchema).default([]),
    /** Tile the player escapes through. */
    exit: PointSchema.optional(),
    /** Entering this zone wakes the monsters and starts the chase. */
    pursuitTrigger: RectSchema.optional(),
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
    const inBounds = (x: number, y: number) =>
      x < level.width && y < level.height;
    level.monsters.forEach((monster, i) => {
      if (!inBounds(monster.x, monster.y)) {
        ctx.addIssue({
          code: "custom",
          message: `monster "${monster.id}" spawn is outside level bounds`,
          path: ["monsters", i],
        });
      }
      monster.patrol.forEach((point, j) => {
        if (!inBounds(point.x, point.y)) {
          ctx.addIssue({
            code: "custom",
            message: `monster "${monster.id}" patrol point is outside level bounds`,
            path: ["monsters", i, "patrol", j],
          });
        }
      });
    });
    if (level.exit) {
      if (!inBounds(level.exit.x, level.exit.y)) {
        ctx.addIssue({
          code: "custom",
          message: "exit is outside level bounds",
          path: ["exit"],
        });
      } else if (
        level.tiles[level.exit.y * level.width + level.exit.x] === TileKind.Wall
      ) {
        ctx.addIssue({
          code: "custom",
          message: "exit is on a wall tile",
          path: ["exit"],
        });
      }
    }
    if (level.pursuitTrigger) {
      const t = level.pursuitTrigger;
      if (t.x + t.width > level.width || t.y + t.height > level.height) {
        ctx.addIssue({
          code: "custom",
          message: "pursuitTrigger extends outside level bounds",
          path: ["pursuitTrigger"],
        });
      }
    }
  });

export type Zone = z.infer<typeof ZoneSchema>;
export type MonsterSpawn = z.infer<typeof MonsterSpawnSchema>;
export type Rect = z.infer<typeof RectSchema>;
export type LevelData = z.infer<typeof LevelSchema>;

export function parseLevel(input: unknown): LevelData {
  return LevelSchema.parse(input);
}
