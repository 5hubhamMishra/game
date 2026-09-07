# apps/web

The Between Words website: Next.js App Router, React, Tailwind CSS. Uses
`@bw/game-core` and `@bw/content` from this workspace directly (no build step
between them — see `transpilePackages` in `next.config.ts`).

## Commands

Run from the repository root so the workspace resolves:

```bash
npm run dev            # apps/web dev server
npm run build           # apps/web production build
npm run -w apps/web lint
npm run -w apps/web typecheck
```

## Status

Pass & Play (`/local`, `/local/play`) is fully implemented against the pure
engine. Online rooms (`/online`) need the Phase 3 backend and are an honest
placeholder until then — see `docs/progress.md` at the repository root.
