import { z } from "zod";
import type { MonsterKind } from "@/game/ai/types";

export const TileKind = {
  Floor: 0,
  Wall: 1,
  /** Bottomless pit (Level 0 "Hole Variation"). Walkable, but stepping on it
   *  is a fall — lethal, regardless of monster lethality. Not a sight blocker. */
  Hole: 2,
} as const;

/**
 * Thematic tag for a zone. Drives tinting / lighting so the documented Level 0
 * sub-sections read distinctly: sticky Red Rooms, unlit Blackout Zones, the
 * rare warm Manila Room.
 */
export const ZoneKind = z.enum(["red", "blackout", "manila"]);
export type ZoneKindT = z.infer<typeof ZoneKind>;

export const ZoneSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hidden: z.boolean().default(false),
  kind: ZoneKind.optional(),
});

export const PointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/** Keep in sync with {@link MonsterKind} in `game/ai/types.ts`. */
export const MonsterKindSchema = z.enum([
  "pursuer",
  "lurker",
  "hound",
  "smiler",
  "faceling",
  "skinstealer",
  "deathmoth",
  "duller",
  "wretch",
  "partygoer",
]) satisfies z.ZodType<MonsterKind>;

export const MonsterSpawnSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  /** Looping patrol waypoints in tile coordinates. Empty = stationary. */
  patrol: z.array(PointSchema).default([]),
  /** Monster identity/role. Defaults to "lurker" so old/missing saved level
   *  data (pre-roster) validates unchanged. */
  kind: MonsterKindSchema.default("lurker"),
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
    tiles: z.array(z.number().int().min(0).max(2)),
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
      } else {
        const exitTile =
          level.tiles[level.exit.y * level.width + level.exit.x];
        if (exitTile === TileKind.Wall || exitTile === TileKind.Hole) {
          ctx.addIssue({
            code: "custom",
            message: "exit is on a non-floor tile",
            path: ["exit"],
          });
        }
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
