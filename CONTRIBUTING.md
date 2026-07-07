# Contributing

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`).
2. Keep changes small and focused. Prototype first; do not fully build features
   that are not yet required.
3. Run the quality gate before opening a PR (see below).
4. Open a PR describing intent and linking the related issue.

## Quality Gate

All must pass locally before review:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
```

## Conventional Commits

Format: `type(scope): subject`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.

Suggested scopes: `app`, `engine`, `ui`, `ai`, `visibility`, `level`, `audio`,
`perf`, `save`, `settings`.

Examples:

```
feat(engine): add line-of-sight fog of war to MainScene
fix(visibility): stop reveal leaking through diagonal wall corners
refactor(ai): extract perception snapshot from monster entity
docs(architecture): document app/game boundary rule
```

## Code Quality Rules

- **TypeScript strict**, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. No `any`, no non-null bang chains as a habit.
- **App/game separation is non-negotiable.** No React inside `src/game`. No
  Phaser inside `src/app` UI. The only bridge is the settings store.
- **No React re-render in the game loop.** Game state lives in Phaser; the app
  reads via the observable store, not the reverse.
- **Validate external data.** Settings, savegames, and imported level data pass
  through their Zod schema before use.
- **Performance in `update()`.** Avoid per-frame allocation; reuse vectors and
  buffers. Recompute expensive systems (visibility) only when inputs change.
- **Security.** No secrets or tokens in the repo. No `eval`, no unsafe dynamic
  imports. No debug logging of personal data. `no-console` is enforced (only
  `warn`/`error` allowed).
- **Keep it minimal.** No AI-slop files, no speculative abstractions, no
  redundant comments. Comment only non-obvious intent.

## Assets

Pixel-art, 2D only. Placeholder textures are generated procedurally in
`PreloadScene`; real sprite atlases replace them without touching scene logic.
