# GitHub Project Plan — `2d-web-backrooms-game`

Everything needed to stand up the board: columns, labels, milestones, and the
full issue list. Copy the `gh` commands, or transcribe the tables into the
GitHub UI. Milestone dates assume a start of **Mon 2026-07-06**.

---

## Board Columns

`Backlog` → `Ready` → `In Progress` → `Review` → `Done`

Create the Project (v2) board:

```bash
gh project create --owner "@me" --title "2d-web-backrooms-game"
# Then add a single-select field "Status" with the five options above,
# or use the default Status field and rename its options.
```

---

## Labels

| Label              | Color     | Meaning                     |
| ------------------ | --------- | --------------------------- |
| `type:feature`     | `#1d76db` | new functionality           |
| `type:bug`         | `#d73a4a` | defect                      |
| `type:refactor`    | `#5319e7` | internal change, no feature |
| `type:docs`        | `#0075ca` | documentation               |
| `type:test`        | `#0e8a16` | tests                       |
| `area:app`         | `#c2e0c6` | Next.js shell               |
| `area:gameplay`    | `#fef2c0` | player-facing mechanics     |
| `area:engine`      | `#bfdadc` | Phaser core / scenes        |
| `area:ui`          | `#d4c5f9` | menus / overlays            |
| `area:ai`          | `#f9d0c4` | monster behaviour           |
| `area:visibility`  | `#fbca04` | fog / line of sight         |
| `area:level`       | `#c5def5` | levels / tilemaps           |
| `area:audio`       | `#bfd4f2` | sound                       |
| `area:performance` | `#e99695` | perf / profiling            |
| `priority:high`    | `#b60205` | do first                    |
| `priority:medium`  | `#fbca04` | normal                      |
| `priority:low`     | `#0e8a16` | nice to have                |

```bash
gh label create "type:feature"     --color 1d76db
gh label create "type:bug"         --color d73a4a
gh label create "type:refactor"    --color 5319e7
gh label create "type:docs"        --color 0075ca
gh label create "type:test"        --color 0e8a16
gh label create "area:app"         --color c2e0c6
gh label create "area:gameplay"    --color fef2c0
gh label create "area:engine"      --color bfdadc
gh label create "area:ui"          --color d4c5f9
gh label create "area:ai"          --color f9d0c4
gh label create "area:visibility"  --color fbca04
gh label create "area:level"       --color c5def5
gh label create "area:audio"       --color bfd4f2
gh label create "area:performance" --color e99695
gh label create "priority:high"    --color b60205
gh label create "priority:medium"  --color fbca04
gh label create "priority:low"     --color 0e8a16
```

---

## Milestones

| Milestone | Theme                       | Due date   |
| --------- | --------------------------- | ---------- |
| Week 1    | Project setup & shell       | 2026-07-13 |
| Week 2    | Movement & world            | 2026-07-20 |
| Week 3    | Visibility & fog of war     | 2026-07-27 |
| Week 4    | Monster AI foundation       | 2026-08-03 |
| Week 5    | Systems & persistence       | 2026-08-10 |
| Week 6    | Performance, tests, release | 2026-08-17 |

```bash
REPO="OWNER/2d-web-backrooms-game"   # set to your repo
gh api repos/$REPO/milestones -f title="Week 1 — Project setup & shell"       -f due_on="2026-07-13T23:59:59Z"
gh api repos/$REPO/milestones -f title="Week 2 — Movement & world"            -f due_on="2026-07-20T23:59:59Z"
gh api repos/$REPO/milestones -f title="Week 3 — Visibility & fog of war"     -f due_on="2026-07-27T23:59:59Z"
gh api repos/$REPO/milestones -f title="Week 4 — Monster AI foundation"       -f due_on="2026-08-03T23:59:59Z"
gh api repos/$REPO/milestones -f title="Week 5 — Systems & persistence"       -f due_on="2026-08-10T23:59:59Z"
gh api repos/$REPO/milestones -f title="Week 6 — Performance, tests, release" -f due_on="2026-08-17T23:59:59Z"
```

---

## Issues

Status reflects what the foundation prototype already delivered. `Done` items
are checked in; the rest are Backlog/Ready.

| #   | Title                         | Milestone | Labels                                           | Status  |
| --- | ----------------------------- | --------- | ------------------------------------------------ | ------- |
| 1   | Project Setup                 | Week 1    | type:feature, area:app, priority:high            | Done    |
| 2   | Next.js App Shell             | Week 1    | type:feature, area:app, priority:high            | Done    |
| 3   | Phaser Client Integration     | Week 1    | type:feature, area:engine, priority:high         | Done    |
| 4   | Game Scene Lifecycle          | Week 1    | type:feature, area:engine, priority:high         | Done    |
| 5   | Main Menu                     | Week 1    | type:feature, area:ui, priority:high             | Done    |
| 6   | Settings Screen               | Week 1    | type:feature, area:ui, priority:medium           | Done    |
| 7   | Credits Screen                | Week 1    | type:feature, area:ui, priority:low              | Done    |
| 8   | Skin Selection Placeholder    | Week 1    | type:feature, area:ui, priority:low              | Done    |
| 9   | Player Movement               | Week 2    | type:feature, area:gameplay, priority:high       | Done    |
| 10  | Collision System              | Week 2    | type:feature, area:gameplay, priority:high       | Done    |
| 11  | Camera System                 | Week 2    | type:feature, area:engine, priority:medium       | Done    |
| 12  | Placeholder Backrooms Level   | Week 2    | type:feature, area:level, priority:high          | Done    |
| 13  | Tilemap Loading               | Week 2    | type:feature, area:level, priority:medium        | Ready   |
| 14  | Visibility System Prototype   | Week 3    | type:feature, area:visibility, priority:high     | Done    |
| 15  | Fog of War                    | Week 3    | type:feature, area:visibility, priority:high     | Done    |
| 16  | Line-of-Sight Corridor Reveal | Week 3    | type:feature, area:visibility, priority:high     | Done    |
| 17  | Hidden Corridor Discovery     | Week 3    | type:feature, area:visibility, priority:medium   | Done    |
| 18  | Monster Entity Foundation     | Week 4    | type:feature, area:ai, priority:high             | Ready   |
| 19  | Monster AI State Machine      | Week 4    | type:feature, area:ai, priority:high             | Done    |
| 20  | Monster Patrol Behavior       | Week 4    | type:feature, area:ai, priority:medium           | Backlog |
| 21  | Monster Chase Behavior        | Week 4    | type:feature, area:ai, priority:medium           | Backlog |
| 22  | Monster Search Behavior       | Week 4    | type:feature, area:ai, priority:medium           | Backlog |
| 23  | Player Detection System       | Week 4    | type:feature, area:ai, priority:high             | Backlog |
| 24  | Level Transition System       | Week 5    | type:feature, area:level, priority:medium        | Backlog |
| 25  | Audio Manager                 | Week 5    | type:feature, area:audio, priority:medium        | Ready   |
| 26  | Save and Settings Persistence | Week 5    | type:feature, area:app, priority:high            | Ready   |
| 27  | Performance Profiling         | Week 6    | type:refactor, area:performance, priority:medium | Backlog |
| 28  | Vitest Setup                  | Week 6    | type:test, area:engine, priority:high            | Done    |
| 29  | Playwright Startup Test       | Week 6    | type:test, area:app, priority:medium             | Done    |
| 30  | Documentation                 | Week 6    | type:docs, area:app, priority:medium             | Done    |
| 31  | Release Build Pipeline        | Week 6    | type:feature, area:app, priority:medium          | Backlog |

### Issue details & acceptance criteria

1. **Project Setup** — Next.js App Router, TS strict, ESLint flat config,
   Prettier, Vitest, Playwright. _AC:_ `npm run typecheck/lint/test/build` pass.
2. **Next.js App Shell** — routes for menu/game/settings/credits/skins. _AC:_
   all pages render; no Phaser in the shell.
3. **Phaser Client Integration** — client-only mount, dynamic import, teardown.
   _AC:_ canvas mounts on `/game`; no SSR eval; destroys on unmount.
4. **Game Scene Lifecycle** — Boot → Preload → Main. _AC:_ textures generated in
   Preload; Main starts cleanly; shutdown releases systems.
5. **Main Menu** — Start / Settings / Credits / Skins. _AC:_ keyboard/mouse
   reachable; links route correctly.
6. **Settings Screen** — volumes, show-FPS; zod-validated persistence. _AC:_
   values persist across reloads; invalid storage falls back to defaults.
7. **Credits Screen** — static credits. _AC:_ renders; back to menu.
8. **Skin Selection Placeholder** — locked grid, no over-implementation. _AC:_
   placeholder only; `skinId` reserved in settings.
9. **Player Movement** — WASD/arrows, normalized diagonals. _AC:_ smooth move;
   no per-frame allocation.
10. **Collision System** — static wall bodies. _AC:_ player cannot pass walls or
    leave world bounds.
11. **Camera System** — follow + bounds + pixel snapping. _AC:_ camera tracks
    player; no sub-pixel shimmer.
12. **Placeholder Backrooms Level** — rooms + corridors. _AC:_ explorable;
    validated `LevelData`.
13. **Tilemap Loading** — move from array build to Phaser Tilemap + external JSON
    with schema validation on import. _AC:_ level loads from data file; invalid
    data rejected.
14. **Visibility System Prototype** — engine-independent grid + tests. _AC:_ unit
    tested reveal/occlusion.
15. **Fog of War** — three-state fog with memory. _AC:_ unseen/discovered/visible
    render distinctly.
16. **Line-of-Sight Corridor Reveal** — raycast occlusion. _AC:_ walls block
    tiles behind them; wall itself visible.
17. **Hidden Corridor Discovery** — concealed until entered. _AC:_ hidden zone
    stays dark until the player steps in, then reveals.
18. **Monster Entity Foundation** — sprite + arcade body + spawn. _AC:_ monster
    exists in scene, collides with walls.
19. **Monster AI State Machine** — patrol/search/chase/attack/lost FSM + tests.
    _AC:_ full transition coverage (done).
20. **Monster Patrol Behavior** — patrol path/wander. _AC:_ monster patrols in
    Patrol state.
21. **Monster Chase Behavior** — path toward player. _AC:_ monster closes
    distance in Chase.
22. **Monster Search Behavior** — go to last-known position and sweep. _AC:_
    monster searches then downgrades on timeout.
23. **Player Detection System** — LOS + distance (+ noise hooks) feeding
    `Perception`. _AC:_ detection drives state transitions in-game.
24. **Level Transition System** — exits move between levels, carry state. _AC:_
    player transitions; save updated.
25. **Audio Manager** — music/SFX assets, per-channel volume from settings. _AC:_
    volumes respond live to settings changes.
26. **Save and Settings Persistence** — savegame store on the existing schema.
    _AC:_ save/load round-trips; invalid saves rejected.
27. **Performance Profiling** — allocation audit, pooling, draw-call review.
    _AC:_ steady 60 fps on target level; no GC spikes in the loop.
28. **Vitest Setup** — isolated game-logic tests. _AC:_ `npm run test` green
    (done).
29. **Playwright Startup Test** — app smoke. _AC:_ menu/settings/game canvas
    smoke tests pass (done).
30. **Documentation** — architecture, roadmap, systems, planning. _AC:_ docs in
    `docs/` current with code.
31. **Release Build Pipeline** — CI: typecheck + lint + test + build (+ e2e).
    _AC:_ pipeline green on PRs; production build artifact.

### Bulk-create issues

```bash
REPO="OWNER/2d-web-backrooms-game"
gh issue create --repo $REPO --title "Tilemap Loading" \
  --label "type:feature,area:level,priority:medium" \
  --milestone "Week 2 — Movement & world" \
  --body "Load levels from external JSON via Phaser Tilemap; validate with the level zod schema on import."
# …repeat per row above, adjusting title/labels/milestone/body.
```

> Tip: keep the "Status" of the checked-in items (`Done`) accurate when importing
> so the board reflects the working prototype from day one.
