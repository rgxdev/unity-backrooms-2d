# Todo: Per-Level Monster Rosters

Full detail in [plan.md](./plan.md). Check off in order; each checkpoint needs a green build/test run + manual playtest before continuing.

## Phase 0 — Research
- [ ] Task 0: Verify canonical entities per level vs. Backrooms wiki (Smiler/Faceling/Skin-Stealer/Hound/Deathmoth + Level 3 gap)

## Phase 1 — Foundation
- [ ] Task 1: Add `kind` field to `MonsterSpawnSchema` (default `"lurker"`)
- [ ] Task 2: `MONSTER_KIND_CONFIG` table + `LEVEL_MONSTER_ROSTER` per official level
- [ ] **Checkpoint:** build/tsc/vitest clean, no behavior change yet, human review

## Phase 2 — Wire it up
- [ ] Task 3: Generator assigns `kind` per spawn from level roster (deterministic per seed)
- [ ] Task 4: `MainScene.spawnMonsters` reads `kind` (retire `isHoundSpawn`/`houndMonsters` special-case)
- [ ] **Checkpoint:** tests green, playtest Levels 0-2 show distinct kinds, human review

## Phase 3 — New behaviors
- [ ] Task 5: Skin-Stealer "avoid eye contact" mechanic (Level 1)
- [ ] Task 6: Faceling harmless decoy (Level 1)
- [ ] Task 7: Deathmoth swarm graze (Level 2) + Smiler jump-scare variant (Level 0)
- [ ] **Checkpoint:** tests green, all 5 levels playtested, human review

## Phase 4 — Density & polish
- [ ] Task 8: Raise monster counts (`DIFFICULTY_CONFIG`, `MAX_MONSTERS`) + tune roster weights
- [ ] Task 9: Lore/blurb pass so text matches actual spawns

## Final checkpoint
- [ ] Full suite green (build, tsc, vitest, playwright if in scope)
- [ ] All 5 levels playtested at easy/middle/hard
- [ ] Docs updated (`monster-ai-plan.md`, `feature-roadmap.md`)
- [ ] Ready for review/merge
