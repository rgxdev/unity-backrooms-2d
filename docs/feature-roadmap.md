# Feature Roadmap

A 6-week plan from setup to a playable prototype release. Each week is a
milestone; features stay minimal until the prototype is stable.

## Week 1 — Foundation ✅ (prototype in place)

- Project setup: Next.js App Router, TypeScript strict, ESLint, Prettier.
- Phaser client integration (client-only mount, clean teardown).
- Main menu + navigation (Start, Settings, Credits, Skins placeholder).
- First Phaser scene chain: Boot -> Preload -> Main.

## Week 2 — Movement & World ✅ (prototype in place)

- Player movement (WASD / arrows), normalized diagonal speed.
- Collision system via static wall group.
- Camera follow with world bounds.
- Placeholder Backrooms level (rooms + corridors), tilemap-shaped level data.

## Week 3 — Visibility

- Fog of war grid with three states (unseen / discovered / visible).
- Line-of-sight reveal via raycast (implemented; tune + optimize).
- Hidden corridors that stay concealed until discovered (implemented; expand).
- Soft edges / smoothing pass; profile large maps.

## Week 4 — Monster AI Foundation

- Monster entity + spawn.
- Wire `MonsterStateMachine` (patrol / search / chase / attack / lost).
- Perception: line-of-sight + distance; noise hooks stubbed.
- Basic patrol paths and chase movement.

## Week 5 — Systems & Persistence

- Level system + level transitions.
- Audio manager with music/SFX assets and per-channel volumes.
- Settings persistence (done) + savegame persistence (schema done, wire store).
- Skin selection groundwork (atlas swap keyed by `skinId`).

## Week 6 — Polish & Release

- Performance pass: object pooling, allocation audit, draw-call review.
- Expand unit tests (visibility, AI) and Playwright coverage.
- Documentation refresh.
- Playable prototype release build.

## Status Legend

✅ done · 🔜 next · ⏳ planned

The current codebase covers Weeks 1–2 fully and ships working prototypes of the
Week 3 visibility features (fog, LOS, hidden zones) plus the Week 4 AI state
machine as tested, engine-independent logic ready to wire into an entity.
