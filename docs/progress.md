# Progress

Tool-neutral status board. Update it with facts and the exact commands that
produced them, not intentions. A note here is **not** a lock — check `git status`
before editing anything you do not own.

## Current state

| Phase | Status |
|---|---|
| 0 — inspect environment, resolve repo | Done |
| 1 — pure engine, content, validators, rule tests | Done |
| 2 — design system, public pages, full local game | Done |
| 3 — Postgres, sessions, rooms, realtime | Done |
| 4 — QA, security, performance, packaging | Done |
| 5 — publish and production smoke test | In progress |

## Completed

### Phase 0 — environment

Verified present: Node v22.23.2, npm 10.9.8, corepack 0.34.6, git 2.53.0,
Vercel CLI 59.5.0, Docker 29.7.2.
Verified missing: `gh` (blocks the automatic push in §10C), `psql` (not needed —
Docker supplies Postgres locally).

Repository initialised at the project root on branch `main`. Commit identity is
repo-local and set to the user's existing verified GitHub identity. No remote is
configured yet.

**Environment note:** this machine has `NODE_ENV=production` exported globally,
which makes plain `npm install` silently skip every devDependency. All install
commands must run as `NODE_ENV=development npm install --include=dev`. The setup
script added in Phase 4 must handle this rather than assume a clean shell.

### Phase 1 — engine (`packages/game-core`)

Commit `c31d741`.

Pure deterministic state machine. `now` and the RNG are passed in as explicit
inputs, so the same code drives the local adapter and the authoritative server.

Validation actually run:

    NODE_ENV=development npx tsc -b        # exit 0
    NODE_ENV=development npx vitest run    # 50 passed (50)

Covered by those tests: K-of-N assignment and the `2K < N` boundary, randomized
pair orientation, speaker rotation with eliminated players filtered out, clue
validation (length, token count, own-word rejection, and the deliberate refusal
to test against the other secret word), plurality voting, single runoff,
repeated-tie and zero-vote outcomes, all three win conditions in their required
order, an eliminated teammate still scoring, abort without points, and
single-step overdue recovery. RNG distribution is checked for modulo bias.

### Phase 1 — content (`packages/content`)

500 reviewed unordered pairs across ten categories, 50 each: food, drinks,
clothing, household, animals, transport, places, sports, technology, music.
Each row carries an editorial note recording how the two words actually differ;
the notes are internal and never sent to a client.

Ids are a 12-hex-character SHA-256 of the sorted normalized pair, so A/B and B/A
are the same pair, the id leaks nothing about the words, and rebuilding never
renumbers the catalog. `CONTENT_VERSION` is snapshotted by a running game so a
catalog update cannot alter a pair mid-round.

Custom host lists parse from `wordA,wordB,category,difficulty` CSV
(`examples/custom-pairs.csv`), including quoted fields and embedded commas.
Bad rows are reported per line rather than failing the whole file, and custom
pairs are tagged `custom:<version>` so they cannot be confused with reviewed
content.

Validation actually run:

    NODE_ENV=development npx tsc -b                            # exit 0
    NODE_ENV=development npx vitest run                        # 64 passed (64)
    NODE_ENV=development npx tsx packages/content/src/validate.ts
    # ✓ 500 pairs across 10 categories (expansion milestone: 1000)

The validator fails the build on: schema violations, a pair whose two words
normalize identically, an unordered duplicate, an id collision, fewer than 500
pairs, fewer than 10 categories, or fewer than 30 pairs in any category.

**Not yet done:** the pairs are editorial judgements, not playtested. The 1000
expansion milestone stays open until Phase 5 play confirms which pairs are
actually guessable.

### Phase 2 — `apps/web`

Next.js 16 App Router, React 19, Tailwind CSS v4. `next.config.ts` sets
`transpilePackages` for the two workspace packages (they ship raw `.ts`
source, no build step) and `agentRules: false` — Next 16 auto-generates
`AGENTS.md`/`CLAUDE.md` on `dev`/`build` by default, which §10B forbids;
confirmed absent after both a dev run and a production build with the flag
set.

Routes: `/`, `/local` (setup), `/local/play` (game), `/online` (room entry),
`/room/[code]` (online lobby and game), `/how-to-play`, `/privacy`, and the
default 404.

The complete local Pass & Play game is wired to `@bw/game-core` directly —
no server, so this is the "best-effort local secrecy" the spec describes, not
enforced isolation. `LocalGameProvider` (`src/app/local/layout.tsx`) holds
`GameState` in React state only, shared across `/local` and `/local/play` by
Next's layout persistence across client-side navigation, and reset on a full
refresh — the deliberate "refresh discards the active game" behavior, stated
in copy on the setup page. Roster, rule preferences, and cross-game scores
persist to `localStorage`; secret assignments never do.

Covered: private per-player reveal and voting via a shared shield/reveal
pattern that also closes on `visibilitychange`/`blur` so a backgrounded tab
can't leave a word or ballot on screen; local clues are spoken aloud, so the
UI only rotates turns and logs "Clue given aloud" rather than pretending to
transcribe or validate speech; discussion's early-vote request/accept path;
runoff voting with participation-only progress (never live counts); neutral
elimination; results revealing both words, every player's group, and a
plain-language reason; once-per-game scoring keyed off a session symbol, not
a `GameState` field; custom pairs by pasted CSV or file import, with
per-row errors and the ≥5-pair gate for custom-only play; an aborted-game
screen for a missed reveal deadline.

Validation actually run:

    npm run typecheck   # tsc -b (packages) + tsc --noEmit (apps/web) — exit 0
    npm run lint         # eslint on apps/web — exit 0
    npm run content:validate
    npm run test         # 63 passed (63)
    npm run build         # next build — 7 static routes, no prerender errors

Not run: a real browser session (no browser automation tool was available
this session — the user declined the Chrome extension). SSR output for every
route was checked with `curl` against `next dev`, and the production build's
static-generation pass exercises each page's initial render, but no click
path was exercised end to end in an actual browser. Treat the local game flow
as typechecked, linted, and unit-tested, not yet visually verified.

**Deviation from Phase 1:** root `typescript` was `7.0.2`; `typescript-eslint`
8.69 (pulled in by `eslint-config-next`) refuses to run above TS 6.1, and npm
hoisted the incompatible version into `eslint-config-next`'s own resolution
instead of nesting a compatible copy. Repinned the whole workspace to
`5.9.3` — current, stable, and what `create-next-app` itself selected for
`apps/web` — rather than carry two TypeScript majors in one repo. `tsc -b`
and the 63 engine/content tests were re-run clean after the change.

**Environment note, corrected:** the `NODE_ENV=development` requirement in
the Phase 0 note is for `npm install` only. Running it in front of `next
build` as well broke the build (`TypeError: Cannot read properties of null
(reading 'useContext')` prerendering `/_global-error`) because it forces
Next's production build into a mixed dev/prod React runtime. `verify` now
assumes dependencies are already installed and runs with an unmodified
`NODE_ENV`.

### Phase 5 — production readiness (in progress)

Docker is now installed and working on this machine (`docker compose up -d
postgres` works; port 5432 can collide with an unrelated project's own
Postgres container — run this project's on a different host port if so,
never touch a container you don't recognize).

A full code review of the Phase 3/4 online backend (commits `43e839e..a6c8595`,
everything since Phase 3 started) found and fixed 9 real bugs, committed
`4bdc1f2`. The most severe: `apps/web/src/features/online/RoomLobby.tsx`'s
join `useEffect` had `status` in its own dependency array while also setting
`status` inside itself — the first snapshot flipped status to `"in-lobby"`,
which reran the effect, whose cleanup disconnected the socket with no
reconnect path back. **Online multiplayer never worked past the initial
lobby screen, in any deployment, the whole time it existed** — invisible to
typecheck/lint/unit tests, only caught by review + a live protocol trace.
Also fixed: a score-wipe on every new game, a `requestRematch` phase-bypass
that could reset a live game, a reconnect-vs-fatal-error mixup, ack-timeout
unhandled rejections, a stale elimination-banner ref, a client/server
error-code mismatch, a misleading host-error message, and a duplicated
engine test that had silently dropped coverage for the default (K=1)
minority-parity-win path.

Built the same-origin session boundary and single-use socket tickets
`docs/SECURITY.md` (below) called out as still needed — see
`docs/decisions.md` for the design. Commit `cd60638`.

Both of the above were verified against a real local stack, not just
typechecked: a temporary Postgres container (`docker run ... -p 5433:5432`,
never the shared `docker-compose.yml`, to avoid the port-5432 collision) plus
`apps/game-server` pointed at it. Confirmed over curl and a throwaway
`socket.io-client` script: the service-token gate 403s unauthenticated
direct access to the backend; the full BFF cookie/session/room-creation flow
works; a minted ticket joins its room exactly once (reuse, forgery, and a
room-code mismatch are all rejected); a seeded nonzero score survives a real
`startGame` call; a mid-game `requestRematch` is rejected with `WRONG_PHASE`
and the live game is left running.

**Not yet done:**
- **Deploy is broken in production right now regardless of the above** —
  `vercel env ls production` returns zero env vars; the deployed client
  bundle has `localhost:8787` baked into it (confirmed by downloading and
  grepping the production JS). The real Render URL for `apps/game-server`
  is still unknown — `render.yaml` names the service
  `between-words-game-server` but that hostname isn't live on Render
  (`x-render-routing: no-server`). Once the real URL is known: set
  `GAME_SERVER_URL`, `GAME_SERVER_SERVICE_TOKEN`, and
  `NEXT_PUBLIC_GAME_SERVER_URL` on Vercel (production), and
  `INTERNAL_SERVICE_TOKEN` + `FRONTEND_ORIGIN` on Render, with matching
  token values on both sides.
- No real-browser click-through this session either — the Claude-in-Chrome
  extension was not connected. Everything above was verified over
  curl/socket.io-client/vitest, not an actual browser session. Worth doing
  once the extension is available, or once staging is reachable to a human.
- Local Pass & Play's player cap was tightened from ~3–24 to 4–10 in
  `a6c8595` ("Support bounded multi-cycle games"), deliberately on both the
  engine and the local setup UI — flag to the user if a large local group
  ever comes up; not reverted since it reads as an intentional decision.

## Next bounded task

Get the real Render URL for `apps/game-server`, wire the Vercel/Render env
vars listed above, and run one real multi-browser (or at least
multi-device) online smoke test against the live production stack. Only
after that should Phase 5 be called complete.
