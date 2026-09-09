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
engine. Online rooms (`/online`, `/room/[code]`) use the Phase 3 HTTP and
Socket.IO backend; local PostgreSQL is still required for a live room.
Session/room HTTP calls go through this app's own same-origin `src/app/api/*`
routes (a backend-for-frontend), not directly to `apps/game-server` — see
`docs/decisions.md` and `docs/SECURITY.md`.
