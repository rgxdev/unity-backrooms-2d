# Implementation Plan: Per-Level Monster Rosters (Backrooms-Wiki-Accurate)

## Overview

Today every level spawns the same two "roles" — a `pursuer` and generic
`lurker`s — where a `lurker` has a flat chance to reroll as a `Hound` from
Level 1 onward ([`MainScene.isHoundSpawn`](../src/game/scenes/MainScene.ts:1108)).
Visual/behavioural distinction is entirely tint + scale + tuning on one shared
`Monster` sprite ([`Monster.ts`](../src/game/entities/Monster.ts)) — there is
no per-level identity. `lore.ts` already *namechecks* Smilers (Level 0),
Facelings/Skin-Stealers/Hounds (Level 1), and Deathmoths/Hounds (Level 2), but
none of those exist as actual spawns — the lore is aspirational, not wired up.

Goal: give each official level (`OFFICIAL_LEVELS`, index 0–4) its own roster of
2–3 distinct monster kinds, drawn from documented Backrooms-wiki entities,
more of them per level, each with a distinguishable look/sound/behavior — not
just a recolored lurker — while keeping the existing scripted-dread pacing
(`MonsterDirector`: Ambient → Pursuit → Escaped) intact.

## Architecture Decisions

- **Data-driven roster, not new entity classes.** Keep one `Monster` sprite
  class. Add an explicit `kind: MonsterKind` field to the level schema and a
  per-kind config table (tuning + tint + scale + audio cue), following the
  exact pattern already proven by `HOUND`/`HOUND_TUNING`/`MONSTER_TINT.hound`.
  This is the smallest change that reaches "every level has different
  monsters" without a rewrite of `Monster.ts` or the AI layer.
- **Roster lives next to `OFFICIAL_LEVELS`.** A `LEVEL_MONSTER_ROSTER: Record<number, MonsterRosterEntry[]>`
  keyed by level index, each entry a `{ kind, weight }`. `generate.ts` /
  `level0.ts` roll a kind per non-pursuer spawn from that level's roster
  instead of the current `isHoundSpawn` special case. The `pursuer` role stays
  level-agnostic (it's the scripted chase finale, not lore-specific).
- **New behaviors are additive, not a redesign of the FSM.** Two of the new
  kinds (Skin-Stealer, Faceling) get a small distinct behavior flag each
  (`avoidGaze`, `harmless`) consumed by `MainScene`'s existing per-monster
  update loop — not a second state machine. Deathmoths and Smilers are visual
  variants of existing ambient/jump-scare monsters plus one new lightweight
  hazard (moth swarm graze) — no new AI code required.
- **Verify wiki canon before locking names/behavior.** The user's requirement
  is explicit ("nach der offiziellen Backrooms wiki immer richten"). Levels
  0–2 already have codebase-authored canon in `lore.ts` to build on; Level 3
  (Poolrooms) and Level 4 (this game's original "Run For Your Life", not a
  1:1 wiki level) need a research pass before writing new lore text, so
  Phase 0 is a research checkpoint, not an assumption.

## Task List

### Phase 0: Research checkpoint (no code)

- [ ] **Task 0: Verify canonical entities per level against the Backrooms wiki**
  - **Description:** Confirm (via web search against backrooms-wiki.wikidot.com
    community docs) the documented entities for Level 0 (Smiler), Level 1
    (Facelings, Skin-Stealers, Hounds — already in `lore.ts`), Level 2
    (Deathmoths, Hounds), and find an appropriate low-key entity for Level 3
    Poolrooms (wiki historically lists it as entity-sparse — need a
    canon-consistent choice, e.g. a rare Skin-Stealer/Faceling crossover
    rather than inventing something new). Level 4 here is original content
    ("Run For Your Life" is not the wiki's Level 4) — keep it as an unnamed
    elite pursuer, no wiki claim needed.
  - **Acceptance criteria:**
    - [ ] Written 1-line-per-entity summary (behavior, hazard, canon source)
      for every kind planned in Phase 2, attached to the plan or lore.ts comment.
    - [ ] Level 3 entity choice is either wiki-documented or explicitly
      flagged as original-content-in-the-spirit-of-canon (no silent invention
      presented as documented fact).
  - **Dependencies:** None.
  - **Files touched:** None (research only; findings feed Task 2/6).

### Phase 1: Data model foundation

- [ ] **Task 1: Add `kind` to the monster spawn schema**
  - **Description:** Add `kind: MonsterKind` (zod enum) to `MonsterSpawnSchema`
    in [`level.ts`](../src/lib/schemas/level.ts:34), defaulting to `"lurker"`
    for backward compatibility with any saved/cached level data. Define
    `MonsterKind` once (e.g. in `constants.ts` or a new `game/entities/monsterKinds.ts`)
    so schema and scene share the same union.
  - **Acceptance criteria:**
    - [ ] `MonsterSpawnSchema` validates and defaults `kind` correctly (missing
      field → `"lurker"`; invalid string → rejected).
    - [ ] `generate.ts`'s `makeMonster` and `level0.ts`'s `makeMonster` compile
      against the new field without behavior change yet (kind unused downstream).
  - **Verification:**
    - [ ] `npm run build` / `tsc` clean.
    - [ ] `npx vitest run src/game/levels` passes (existing generator tests).
  - **Dependencies:** None.
  - **Files likely touched:** `src/lib/schemas/level.ts`, `src/game/levels/generate.ts`, `src/game/levels/level0.ts`.
  - **Estimated scope:** S.

- [ ] **Task 2: Per-kind config table (tuning + tint + scale + roster weights)**
  - **Description:** Generalize the `HOUND` / `HOUND_TUNING` / `MONSTER_TINT.hound`
    pattern into a single table keyed by `MonsterKind`: `MONSTER_KIND_CONFIG:
    Record<MonsterKind, { tuning: MonsterTuning; tint: number; scale?: {x,y};
    noWalkCycle?: boolean }>` in `constants.ts` (tuning objects can live in
    `ai/types.ts` alongside `HOUND_TUNING` as today). Add
    `LEVEL_MONSTER_ROSTER: Record<number, { kind: MonsterKind; weight: number }[]>`
    next to `OFFICIAL_LEVELS` — level 0: lurker + smiler; level 1: lurker +
    hound + faceling + skinstealer; level 2: lurker + hound + deathmoth; level
    3: lurker + (Task 0 result); level 4: lurker only (pursuer already elite).
  - **Acceptance criteria:**
    - [ ] Every `MonsterKind` used in a roster has a config entry (compile-time
      exhaustiveness — e.g. a `satisfies Record<MonsterKind, ...>` check).
    - [ ] Roster weights sum sensibly per level (documented, not required to be 1.0 — a weighted pick helper normalizes).
  - **Verification:** `tsc` clean; unit test for the weighted-pick helper (new, small, pure function — table-driven over a few seeds).
  - **Dependencies:** Task 0 (names/behavior), Task 1 (`MonsterKind` type exists).
  - **Files likely touched:** `src/game/config/constants.ts`, `src/game/ai/types.ts`, `src/game/levels/officialLevels.ts`, `src/game/levels/rng.ts` (weighted pick helper) or new `src/game/levels/roster.ts`.
  - **Estimated scope:** M.

### Checkpoint: Foundation

- [ ] `npm run build`, `npx tsc --noEmit`, `npx vitest run` all clean.
- [ ] No behavior change yet — game still plays identically (kind data exists but unused by the scene).
- [ ] Review with human before proceeding to spawn-time wiring.

### Phase 2: Wire rosters into generation + spawning

- [ ] **Task 3: Generator picks `kind` per spawn from the level's roster**
  - **Description:** Replace `MainScene.isHoundSpawn`'s post-hoc reroll with
    generation-time assignment: `generate.ts`'s `makeMonster` (and `level0.ts`'s)
    take the level's roster + `Rng` and set `kind` directly, keeping the
    `pursuer` id/kind pinned as today. Deterministic per seed (same rules as
    the current hash-based Hound roll, just moved earlier and generalized).
  - **Acceptance criteria:**
    - [ ] Same seed → same monster kinds every regeneration (determinism preserved).
    - [ ] Level 0 never rolls Hound (still Level-1+-only per existing lore gate, now expressed as roster membership instead of an index check).
    - [ ] Existing generator tests updated for the new field; add a test asserting kind distribution roughly matches roster weights over N seeds.
  - **Verification:** `npx vitest run src/game/levels`.
  - **Dependencies:** Task 2.
  - **Files likely touched:** `src/game/levels/generate.ts`, `src/game/levels/level0.ts`, `src/game/levels/generate.test.ts`, `src/game/levels/level0.test.ts`.
  - **Estimated scope:** M.

- [ ] **Task 4: `MainScene.spawnMonsters` reads `kind` instead of `isHoundSpawn`**
  - **Description:** Delete `isHoundSpawn`/`houndMonsters` WeakSet special-casing;
    generalize to a `monsterKinds: WeakMap<Monster, MonsterKind>` (or store kind
    on a small wrapper) driven by `MONSTER_KIND_CONFIG`. Update every call site
    that currently special-cases Hounds (`houndMonsters.has(monster)` at lines
    ~1410 chase-speed lookup and ~1930 fear/audio cue) to look up by kind generically.
  - **Acceptance criteria:**
    - [ ] Hound behavior (chase-speed multiplier, tint, scale, audio cue) is
      bit-for-bit unchanged — this is a refactor of the mechanism, not the tuning.
    - [ ] New kinds (Smiler, Faceling, Skin-Stealer, Deathmoth) render with
      their own tint/scale from `MONSTER_KIND_CONFIG` with no further code changes needed to *add* a kind later.
  - **Verification:** Playwright/manual: start Level 1, confirm Hounds still lean/fast/noise-drawn as before; start Level 0/1/2, confirm visibly distinct tints per kind in the HUD/gameplay via `preview_screenshot`.
  - **Dependencies:** Task 3.
  - **Files likely touched:** `src/game/scenes/MainScene.ts`.
  - **Estimated scope:** M.

### Checkpoint: Rosters live

- [ ] Full test suite green; manual playtest of Levels 0–2 confirms multiple visually distinct monster kinds per level, deterministic per seed.
- [ ] Review with human before adding new behaviors/hazards.

### Phase 3: New behaviors (the "scarier" part)

- [ ] **Task 5: Skin-Stealer — "avoid eye contact" mechanic**
  - **Description:** Per lore.ts ("avoid direct eye contact, do not engage"),
    give this kind the opposite rule from the existing Stalker: it advances
    normally, but if the player's facing/LOS is directly on it for too long
    (reuse `VisibilitySystem.hasLineOfSight`, inverse condition from
    `StalkerAI`), it "notices" and triggers a lunge/flee-punish beat. Simplest
    viable version: a boolean `staredAt` timer per Skin-Stealer instance,
    checked in the scene's per-monster tick, following the same lunge/retreat
    plumbing the Stalker already has (`STALKER.lungeOffset`, retreat/relocate) —
    reuse those constants/methods rather than duplicating them.
  - **Acceptance criteria:**
    - [ ] Looking directly at a Skin-Stealer for > threshold seconds triggers
      a distinct scare beat (own audio cue, own camera pulse) that isn't
      identical to the Stalker's.
    - [ ] Looking away / not in LOS: it behaves like a normal ambient lurker (patrols, no special state).
    - [ ] Unit-testable core (the stare-timer transition logic) kept engine-independent where feasible, mirroring `StalkerAI.test.ts`'s approach.
  - **Verification:** New `SkinStealerAI.test.ts` (or extend `StalkerAI` tests if logic is shared); manual playtest confirms the beat fires and reads distinctly from the Stalker.
  - **Dependencies:** Task 4.
  - **Files likely touched:** `src/game/ai/StalkerAI.ts` (extract shared bits if warranted) or new `src/game/ai/SkinStealerAI.ts`, `src/game/scenes/MainScene.ts`, `src/game/systems/AudioManager.ts`.
  - **Estimated scope:** M.

- [ ] **Task 6: Faceling — harmless decoy (tension via ambiguity)**
  - **Description:** Per lore ("mimics wanderer behaviour, generally harmless
    if not provoked or cornered"), this kind patrols like a lurker but never
    chases/attacks even in Pursuit phase — a monster the player can't be sure
    is safe until they've learned to recognize it. Cheapest correct version:
    a `harmless: true` flag in its kind config that the scene checks before
    letting it register as a Pursuit threat or jump-scare attacker.
  - **Acceptance criteria:**
    - [ ] Faceling never kills/attacks regardless of difficulty.
    - [ ] Still contributes to ambient fear (glimpsed, has a presence cue) so
      it isn't just an invisible no-op — the scare is "was that the friendly one or not?" ambiguity.
  - **Verification:** Manual playtest; a unit test on the `MonsterKindConfig` lookup confirming `harmless` kinds are excluded from the kill-radius check.
  - **Dependencies:** Task 4.
  - **Files likely touched:** `src/game/scenes/MainScene.ts`, `src/game/config/constants.ts`.
  - **Estimated scope:** S.

- [ ] **Task 7: Deathmoth swarm + Smiler jump-scare variant**
  - **Description:** Deathmoths (Level 2, "cluster near active steam vents"):
    a visually distinct (small, erratic-movement) ambient kind that, on
    contact, triggers a brief harmless-but-startling "swarm graze" (screen
    flutter + wing-buzz cue) rather than the standard growl/approach — reuses
    the jump-scare visual pipeline with a new cue. Smiler (Level 0): reuse the
    existing jump-scare "peek" system (`JUMPSCARE.peekChance`) but let the
    peeking monster's *kind* vary per level roster instead of always being the
    generic monster texture/tint, so Level 0's peeks specifically read as Smilers.
  - **Acceptance criteria:**
    - [ ] Deathmoth contact triggers its own distinct cue, never lethal, never on non-Level-2.
    - [ ] Level 0 jump-scares are visually tagged as Smiler (tint/scale from `MONSTER_KIND_CONFIG`); other levels' jump-scares use their own roster's non-pursuer kind instead of a hardcoded generic look.
  - **Verification:** `npx vitest run`; manual playtest of Level 0 and Level 2 confirming the distinct beats.
  - **Dependencies:** Task 4.
  - **Files likely touched:** `src/game/scenes/MainScene.ts` (`trySpawnJumpscare`/`updateJumpscare`), `src/game/systems/AudioManager.ts`, `src/game/config/constants.ts`.
  - **Estimated scope:** M.

### Checkpoint: New behaviors

- [ ] Full test suite green.
- [ ] Manual playtest of all 5 levels: each has its own recognizable monster mix and at least one behavior beyond "patrol + generic chase."
- [ ] Review with human before density/pacing tuning.

### Phase 4: More monsters, more dread (density & pacing)

- [ ] **Task 8: Raise monster density per level/difficulty**
  - **Description:** Bump `DIFFICULTY_CONFIG` base/perLevel monster counts and
    `MAX_MONSTERS` (currently 10) so later levels feel more populated,
    balanced against the "one nearest monster at a time" stealth-rendering
    rule (`MONSTER_STEALTH`) that already keeps crowds from reading as chaos.
    Tune per-level roster weights so kind variety scales with count (e.g.
    Level 2 at higher count should show both Hounds and Deathmoths together,
    not just more of one).
  - **Acceptance criteria:**
    - [ ] Higher monster counts on middle/hard don't regress frame pacing
      (spot-check: no per-frame allocation introduced, per `game-architecture.md`'s performance rules).
    - [ ] Secret/manila-style safe rooms remain monster-free (existing invariant preserved).
  - **Verification:** `npx vitest run`; manual playtest at hard difficulty on Level 4 for frame feel; re-check `addSecretRoom`/manila exclusion still holds.
  - **Dependencies:** Task 3 (roster wiring).
  - **Files likely touched:** `src/game/config/constants.ts`, `src/game/levels/generate.ts`, `src/game/levels/level0.ts`.
  - **Estimated scope:** S.

- [ ] **Task 9: Lore + level blurb pass**
  - **Description:** Update `OFFICIAL_LEVELS[].blurb` and, if Task 0 surfaced
    new canon, `lore.ts` entries so the in-game text matches what actually
    spawns now (e.g. Level 0's blurb should hint at the Smiler, Level 3's
    lore should stop saying "no confirmed hostile entities" if a hostile was added there).
  - **Acceptance criteria:**
    - [ ] No lore text contradicts actual spawns.
    - [ ] `getLoreForLevel` fallback behavior unaffected.
  - **Verification:** `npx vitest run src/game/content` (if lore has tests) or manual read-through; `npm run build`.
  - **Dependencies:** Task 7 (final kind set known).
  - **Files likely touched:** `src/game/levels/officialLevels.ts`, `src/game/content/lore.ts`, `docs/monster-ai-plan.md`.
  - **Estimated scope:** S.

### Checkpoint: Complete

- [ ] All acceptance criteria across Tasks 0–9 met.
- [ ] `npm run build`, `npx tsc --noEmit`, `npx vitest run`, and (if in CI scope) `npx playwright test` all green.
- [ ] Manual end-to-end playtest of all 5 levels at easy/middle/hard.
- [ ] Docs (`docs/monster-ai-plan.md`, `docs/feature-roadmap.md`) reflect the new roster system.
- [ ] Ready for human review / merge.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wiki canon for Level 3 (Poolrooms) is genuinely sparse — inventing an entity risks the "always per official wiki" requirement | Med | Phase 0 research checkpoint; if nothing canonical fits, reuse an existing kind crossing over (e.g. rare Skin-Stealer) rather than inventing a new named entity, and say so explicitly instead of presenting it as documented lore |
| More monsters + new behaviors regress the "one glimpse at a time" stealth read (`MONSTER_STEALTH`) into visual chaos | Med | Task 8 tunes density with playtesting against the existing single-nearest-visible rule; checkpoint requires manual playtest before merge |
| Skin-Stealer gaze mechanic duplicates/competes with the existing Stalker for "why are there two staring monsters" confusion | Med | Distinct trigger direction (Stalker punishes looking *away*, Skin-Stealer punishes looking *at* it), distinct audio/visual cue, called out in Task 5 acceptance criteria |
| Refactoring `isHoundSpawn`/`houndMonsters` touches several call sites in `MainScene.ts` (chase speed, fear/audio) — regression risk on the one currently-shipped special kind | Med | Task 4 acceptance criteria explicitly requires Hound behavior stay bit-for-bit identical; verify via manual playtest comparison before adding any new kind's behavior |
| Level schema change (`kind` field) could break any persisted/cached level data | Low | Default `kind` to `"lurker"` in the zod schema (Task 1) so old data validates unchanged |

## Open Questions

- Should Skin-Stealer's "stared at" detection share code with `StalkerAI.ts`
  directly (inverse condition) or live as a sibling module? Recommend
  deciding during Task 5 based on how much of `StalkerAI`'s lunge/retreat
  plumbing is reusable once you're in the code.
- Exact Level 3 entity choice depends on Task 0's research outcome — flagged
  as blocking Task 2's roster table for that level only (other levels can
  proceed independently).
- Do we want a *named* Level 4 elite pursuer variant (visual upgrade) as part
  of this pass, or is "more of the existing pursuer, just more lethal density"
  sufficient? Not currently scoped as a task — call out if wanted.
