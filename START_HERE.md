# Between Words

## Local setup

```sh
npm run setup
```

For online mode, start PostgreSQL:

```sh
npm run db:up
```

## Development

```sh
npm run dev
npm run start -w apps/game-server
```

The web app is at `http://localhost:3000`; the game server is at
`http://localhost:8787`.

## Verification

```sh
npm run verify
```

Local Pass & Play works without Docker. Online mode requires PostgreSQL and
has not received a live multi-browser smoke test in this environment.

## Remaining external steps

Session/room HTTP now goes through `apps/web`'s own same-origin `/api/*`
routes rather than directly to `apps/game-server` — see
[docs/decisions.md](docs/decisions.md) and [docs/SECURITY.md](docs/SECURITY.md).
That means **both** sides need matching config, not just one URL:

1. Deploy `apps/game-server` (Render, via `render.yaml`, or an equivalent
   persistent host — it holds a live Socket.IO connection, so it cannot run
   as a Vercel serverless function). Provide `DATABASE_URL` (managed
   PostgreSQL) and set `FRONTEND_ORIGIN` to the production Vercel domain.
2. Generate one random secret and set it as `INTERNAL_SERVICE_TOKEN` on the
   backend host.
3. On Vercel (production **and** preview, as separate explicit values — do
   not reuse a preview URL/token in production):
   - `GAME_SERVER_URL` — the backend's base URL, server-side only (no
     `NEXT_PUBLIC_` prefix; this is what `src/app/api/*` forwards to).
   - `GAME_SERVER_SERVICE_TOKEN` — the same value as step 2's
     `INTERNAL_SERVICE_TOKEN`.
   - `NEXT_PUBLIC_GAME_SERVER_URL` — the same backend URL again, this one
     public: the browser's Socket.IO connection still goes there directly.
4. Redeploy after setting these — Next.js inlines `NEXT_PUBLIC_*` vars at
   build time, so an env var added after the last build has no effect until
   the next one.
5. Review [docs/SECURITY.md](docs/SECURITY.md) before exposing online mode.
6. Run a real multi-browser smoke test against the live URLs — nothing in
   this repo has done that yet; everything so far is typecheck/lint/test/
   build plus a local Docker Postgres + game-server verification (see
   `docs/progress.md`, Phase 5), not an actual browser session.
