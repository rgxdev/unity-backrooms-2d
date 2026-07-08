import type { MonsterKind } from "@/game/ai/types";
import { weightedPick, type Rng } from "./rng";

export interface RosterEntry {
  kind: MonsterKind;
  /** Relative weight — doesn't need to sum to any fixed total per level;
   *  {@link weightedPick} normalizes across whatever's listed. */
  weight: number;
}

/**
 * Per-level ambient-monster roster, sourced from the documented Backrooms-wiki
 * entity list for each level (see `tasks/research-canon.md` for the full
 * citation pass). `lurker` is always present as the plain baseline so a
 * level never reads as one single reskinned kind. The `pursuer` role is
 * level-agnostic (the scripted chase finale) and is never picked from here —
 * callers keep pinning it directly, same as before this roster existed.
 *
 * Level 0 "The Lobby": wiki lists entities as unconfirmed for this level; the
 * Smiler appears only as a rare, cautious sighting (no confirmed kills),
 * matching its low weight here. No Hound — that's an Upper-Levels-only
 * (Level 1+) entity per the field-guide framing already in lore.ts.
 *
 * Level 1 "Habitable Zone": all three non-lurker kinds are wiki-documented on
 * `level-1`'s own entity table (Faceling, Skin-Stealer, Hound) — the richest,
 * most canon-solid roster of the five.
 *
 * Level 2 "Pipe Dreams": Deathmoth presence is wiki-documented via the
 * `level-2` page; Hounds are "semi-frequent... less noteworthy" there —
 * weighted lower than on Level 1 to read as passing through, not nesting.
 *
 * Level 3 "Poolrooms" (this game's naming): the actual wiki Poolrooms
 * (Level 37) is documented Class-1-Safe and explicitly devoid of entities —
 * kept here at a low, rare Hound weight framed as an anomalous crossover
 * (per the research file's own recommendation), never a named resident.
 *
 * Level 4 "Run For Your Life": original content, not a 1:1 wiki level — the
 * pursuer carries the threat; the rare Wretch (entity-140, a ruined wanderer
 * left behind by this stretch) is the one ambient body that fits its fiction.
 *
 * Level 5 "The Terror Hotel": wiki documents Facelings in period attire
 * throughout the hotel and Deathmoths near the boiler sections; the Partygoer
 * (entity-67) appears as a rare "party spillover" crossover — the hotel's
 * ballrooms are exactly where its kind gravitates (see lore.ts framing).
 *
 * Level 6 "Lights Out": wiki frames it as pitch dark and Smiler territory —
 * their glow-grins are the classic Level 6 sighting. Dullers drift here too
 * (entity-11 favours dark, quiet levels), plus passing Hounds.
 */
export const LEVEL_MONSTER_ROSTER: Record<number, readonly RosterEntry[]> = {
  0: [
    { kind: "lurker", weight: 0.75 },
    { kind: "smiler", weight: 0.25 },
  ],
  1: [
    { kind: "lurker", weight: 0.35 },
    { kind: "hound", weight: 0.3 },
    { kind: "faceling", weight: 0.2 },
    { kind: "skinstealer", weight: 0.15 },
  ],
  2: [
    { kind: "lurker", weight: 0.28 },
    { kind: "hound", weight: 0.18 },
    { kind: "deathmoth", weight: 0.28 },
    { kind: "duller", weight: 0.16 },
    // Entity-5 favours dank industrial nooks — the Clump's tangled drift is
    // exactly what a pipe-maze junction hides best.
    { kind: "clump", weight: 0.1 },
  ],
  3: [
    { kind: "lurker", weight: 0.88 },
    { kind: "hound", weight: 0.12 },
  ],
  4: [
    { kind: "lurker", weight: 0.72 },
    { kind: "wretch", weight: 0.18 },
    // A Clump dragged along in the wake of whatever runs this stretch —
    // rare, slow, and the one thing here you can't out-wait.
    { kind: "clump", weight: 0.1 },
  ],
  5: [
    { kind: "lurker", weight: 0.22 },
    { kind: "faceling", weight: 0.28 },
    { kind: "partygoer", weight: 0.18 },
    { kind: "deathmoth", weight: 0.1 },
    { kind: "wretch", weight: 0.12 },
    // The Beast of Level 5 (entity-21) — canonically below the boiler rooms;
    // rare enough that meeting one reads as the hotel's worst-case night.
    { kind: "beast", weight: 0.1 },
  ],
  6: [
    { kind: "lurker", weight: 0.25 },
    { kind: "smiler", weight: 0.35 },
    { kind: "duller", weight: 0.25 },
    { kind: "hound", weight: 0.15 },
  ],
  // Level 9 "The Suburbs": the Neighborhood Watch is the level's signature
  // entity per the wiki page; Facelings house-sit the furnished homes, and
  // Hound packs cross the yards at night.
  7: [
    { kind: "lurker", weight: 0.2 },
    { kind: "watcher", weight: 0.4 },
    { kind: "faceling", weight: 0.25 },
    { kind: "hound", weight: 0.15 },
  ],
  // "Level Fun =)": Partygoer territory, wall to wall — the wiki is blunt
  // that this level belongs to entity-67. A few Facelings in party hats and
  // stray Deathmoths drawn to the fairy lights round it out.
  8: [
    { kind: "partygoer", weight: 0.55 },
    { kind: "faceling", weight: 0.2 },
    { kind: "lurker", weight: 0.15 },
    { kind: "deathmoth", weight: 0.1 },
  ],
};

/** Roll a non-pursuer monster kind for the given level index. Falls back to
 *  a plain lurker for any level index without an authored roster, same
 *  fallback shape as `getLoreForLevel`/`getOfficialLevel`. */
export function pickMonsterKind(rng: Rng, levelIndex: number): MonsterKind {
  const roster = LEVEL_MONSTER_ROSTER[levelIndex] ?? LEVEL_MONSTER_ROSTER[0]!;
  return weightedPick(rng, roster).kind;
}

/** The level-agnostic scripted-chase finale — never rolled from a level's
 *  roster, always this exact id/kind. Shared by every generator so the
 *  "is this spawn the pursuer" rule lives in one place. */
export const PURSUER_ID = "pursuer";

/** Resolves a monster spawn's kind: pinned `"pursuer"` for the pursuer id,
 *  otherwise a roster roll for the given level. Shared by `generate.ts` and
 *  `level0.ts` so the two generators can't drift on this rule. */
export function resolveMonsterKind(
  id: string,
  rng: Rng,
  levelIndex: number,
): MonsterKind {
  return id === PURSUER_ID ? "pursuer" : pickMonsterKind(rng, levelIndex);
}
