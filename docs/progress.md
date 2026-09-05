# Progress

Tool-neutral status board. Update it with facts and the exact commands that
produced them, not intentions. A note here is **not** a lock — check `git status`
before editing anything you do not own.

## Current state

| Phase | Status |
|---|---|
| 0 — inspect environment, resolve repo | Done |
| 1 — pure engine, content, validators, rule tests | Done |
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
(`examples/custom-pairs.csv`). Bad rows are reported per line rather than
failing the whole file, and custom pairs are tagged `custom:<version>` so they
cannot be confused with reviewed content. Quoting and embedded commas are not
supported.

Validation actually run:

    NODE_ENV=development npx tsc -b                            # exit 0
    NODE_ENV=development npx vitest run                        # 63 passed (63)
    NODE_ENV=development npx tsx packages/content/src/validate.ts
    # ✓ 500 pairs across 10 categories (expansion milestone: 1000)

The validator fails the build on: schema violations, a pair whose two words
normalize identically, an unordered duplicate, an id collision, fewer than 500
pairs, fewer than 10 categories, or fewer than 30 pairs in any category.

**Not yet done:** the pairs are editorial judgements, not playtested. The 1000
expansion milestone stays open until Phase 5 play confirms which pairs are
actually guessable.

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

Phase 2, `apps/web`: Next.js App Router skeleton, the design system harvested
from the root prototype, and the complete local Pass & Play game wired to
`@bw/game-core` and `@bw/content`.

## Blockers

- Both tools are committing to `main` in one shared working tree, which §10
  warns against. Until that is split, each tool should stage only its own paths
  and never `git add .`.
