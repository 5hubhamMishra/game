# Decisions

Meaningful deviations and choices, with the reason. Newest first.

## Codex's root prototype is kept as a design reference, not as the app

`index.html`, `app.js` and `styles.css` at the repository root were written by
Codex while the engine was being built. They are a **static visual prototype**:
the word is hardcoded (`state.word = 'Cappuccino'` for every player), clues come
from a fixed three-item array, and votes are never tallied. There is no role
assignment, so the game's central secret does not exist in them.

They cannot ship as the product — §9 forbids placeholder content in required
flows and mock gameplay presented as working. They are also genuinely useful:
the visual language, spacing, copy tone and the palette applied to real markup
are a solid starting point for the Phase 2 design system.

Decision: keep the files untouched and uncommitted, harvest the design tokens
and copy into the real Next.js implementation during Phase 2, and delete them
only once Phase 2 supersedes them **and** the owning tool agrees. §10 forbids
overwriting another tool's uncommitted edits, and a progress note is explicitly
not a mutex.

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
