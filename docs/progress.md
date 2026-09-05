# Progress

Tool-neutral status board. Update it with facts and the exact commands that
produced them, not intentions. A note here is **not** a lock — check `git status`
before editing anything you do not own.

## Current state

| Phase | Status |
|---|---|
| 0 — inspect environment, resolve repo | Done |
| 1 — pure engine, content, validators, rule tests | Engine done; content catalog outstanding |
| 2 — design system, public pages, full local game | Not started |
| 3 — Postgres, sessions, rooms, realtime | Not started |
| 4 — QA, security, performance, packaging | Not started |
| 5 — publish and production smoke test | Not started |

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

## Ownership right now

Two tools have written into this directory concurrently.

- **Claude Code** owns `packages/**`, `apps/**`, `docs/**`, and the workspace
  config files. Its work is committed.
- **Codex** wrote `index.html`, `app.js`, `styles.css` at the repository root
  (mtime 02:59). These are **uncommitted and untouched** — see
  `docs/decisions.md` for why they are kept and what they are used for.

Do not delete, rewrite, or `git add .` over the root prototype without the
owning tool agreeing first.

## Next bounded task

Author `packages/content`: at least 500 reviewed unordered word pairs across at
least ten categories with at least 30 each, plus the schema, the deterministic
opaque id, and the CI validator. Nothing else depends on it, and it does not
touch the root prototype.

## Blockers

- `gh` is not installed, so no remote exists and no phase can auto-push yet
  (§10A/§10C). Everything else proceeds locally in the meantime.
