# Decisions

Meaningful deviations and choices, with the reason. Newest first.

## Root prototype removed now that Phase 2 supersedes it

This file previously said `index.html`/`app.js`/`styles.css` were kept
uncommitted as a design reference. Checking git history directly (`git log
--oneline -- index.html`) showed they were in fact already committed in
`977a91b`, so the earlier note was stale — a concrete instance of the spec's
own warning not to trust a progress note over the actual repository state.

Their design tokens (ivory/ink/teal/amber palette, DM Sans + Space Grotesk,
16–20px card radii) are now in `apps/web`'s Tailwind theme and layout, and the
real game they only mocked (hardcoded word, fixed clue list, no tally) is
built and wired to `@bw/game-core`. Keeping the static files around after that
is just a second, non-functional copy of the same screens, so they were
removed (`git rm`) as part of the Phase 2 commit rather than left to rot.

## Repinned workspace TypeScript from 7.0.2 to 5.9.3

`tsc -b` on `packages/**` was clean under TS 7.0.2 (Phase 1), but adding
`apps/web` surfaced the real problem: `eslint-config-next` depends on
`typescript-eslint` 8.69, which hard-refuses to run above TypeScript 6.1.
`npm install` hoisted the incompatible 7.0.2 into that dependency's own
resolution instead of nesting a compatible copy, so linting failed outright
rather than as a warning. §6 asks for "current mutually compatible stable
releases" — a compiler the required lint tooling can't run under fails that
regardless of how well it worked in isolation for Phase 1. Repinned the whole
workspace to `5.9.3` (current stable, and what `create-next-app` itself chose
for `apps/web`'s own `"typescript": "^5"`) rather than run two majors in one
repo. Re-verified: `tsc -b` and all 63 engine/content tests still pass.

## Local mode has no typed clue text, by design

§3 says local clues are spoken aloud and explicitly warns against claiming
automatic speech validation. The engine's `submitClue` still needs some
string to validate and record, so the local UI turn control calls it with a
fixed `"Clue given aloud"` string rather than exposing a text field. The clue
log shows that phrase instead of pretending to transcribe what was actually
said — the alternative (a text input players don't really need to fill in
honestly) would invite exactly the fake-validation the spec warns about.

## Private local screens close on tab/window blur, not just navigation

§4 requires that private cards not briefly expose words during exit or
remount, and §3's reconnect-closing rule for online reveal has an obvious
local analogue: if the device holder gets distracted and switches apps while
a word or ballot is on screen, someone else at the table could see it.
`useShieldStage` resets to the shield on `visibilitychange` and `blur`, not
only when the current player changes.

## npm workspaces instead of pnpm or Turborepo

§6 asks for "the simplest workspace tooling appropriate to the repository". npm
10.9.8 ships with the installed Node and already does workspaces, so it adds no
new toolchain, no lockfile format to standardise, and no extra CI install step.
pnpm would need corepack activation on every contributor machine for no benefit
at this size. Revisit only if install time or strict peer resolution becomes a
real problem.

## Randomness is an injected `Rng`, not a module-level function

§6 requires random choices to be explicit inputs to the engine. The engine takes
`{ now, rng }` per call, so reducers stay pure and every rule test is
reproducible from a seed. `nextInt` rather than a float generator is the
primitive, because the crypto implementation can then reject the biased tail of
the uint32 range — `Math.floor(random() * n)` would skew who becomes the
minority, which is exactly the draw that must be fair.

## Clue validation never consults the other secret word

§3 requires rejecting a clue containing a token of the sender's own word, and
warns against creating a probing oracle. Checking against the *other* word would
let a player binary-search it by submitting candidate words and watching which
get rejected. So `validateClue` only ever sees the sender's own word. The
consequence, stated in the UI rather than hidden: simple token matching cannot
catch a clever derivative, and players are told so.

## Scoring idempotency lives in the room, not the engine

The engine exposes `winningPlayers(state)` and holds no score state. §7 requires
a unique idempotency key for scoring a completed game, which is a persistence
concern the database owns. Keeping a `scored` boolean in the pure state would
have duplicated that guarantee in a place that cannot enforce it.

## `settleOverdue` applies one transition per call

§7 requires a restarted server to settle overdue transitions once and open any
newly entered phase with a fresh full duration. Because each transition sets a
new deadline at `now + duration`, the loop naturally stops after one step. A
crash during a long discussion therefore costs the players that phase and no
more, instead of fast-forwarding through several playable phases at once.
