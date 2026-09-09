import { shuffle, sample } from './rng.ts'
import {
  type Ballot,
  type EngineContext,
  type GameState,
  type PlayerId,
  type Settings,
  type VotingRound,
  type WordPair,
  EngineError,
} from './types.ts'

// ---------------------------------------------------------------- setup rules

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 10

/** Largest K satisfying the 2K < N rule, capped at three minority players. */
export function maxMinorityCount(playerCount: number): number {
  return Math.min(3, Math.floor((playerCount - 1) / 2))
}

export function assertValidSetup(playerCount: number, minorityCount: number): void {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new EngineError('INVALID_ROSTER', `A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`)
  }
  if (!Number.isInteger(minorityCount) || minorityCount < 1) {
    throw new EngineError('INVALID_MINORITY_COUNT', 'At least one minority player is required.')
  }
  if (2 * minorityCount >= playerCount) {
    throw new EngineError(
      'INVALID_MINORITY_COUNT',
      `${minorityCount} minority players needs more than ${2 * minorityCount} players in total.`,
    )
  }
  if (minorityCount > maxMinorityCount(playerCount)) {
    throw new EngineError('INVALID_MINORITY_COUNT', 'Minority count exceeds the supported maximum of 3.')
  }
}

function deadlineFrom(now: number, seconds: number | null): number | null {
  return seconds === null ? null : now + seconds * 1000
}

// ------------------------------------------------------------------ selectors

export function activePlayers(state: GameState): PlayerId[] {
  return state.players.filter((id) => !state.eliminated.includes(id))
}

export function isMinority(state: GameState, playerId: PlayerId): boolean {
  return state.minorityIds.includes(playerId)
}

/** The word a given player holds. Callers must not leak this across players. */
export function wordFor(state: GameState, playerId: PlayerId): string {
  if (!state.players.includes(playerId)) throw new EngineError('NOT_A_PLAYER')
  return isMinority(state, playerId) ? state.minorityWord : state.majorityWord
}

/**
 * Speaking order for the current cycle: the fixed random base order rotated by
 * one per cycle, then filtered to survivors so relative order is preserved.
 */
export function cycleOrder(state: GameState): PlayerId[] {
  const n = state.baseOrder.length
  const offset = (state.cycle - 1) % n
  const rotated = [...state.baseOrder.slice(offset), ...state.baseOrder.slice(0, offset)]
  return rotated.filter((id) => !state.eliminated.includes(id))
}

export function currentSpeaker(state: GameState): PlayerId | null {
  return cycleOrder(state)[state.turnIndex] ?? null
}

/** Who may be voted for right now, from `voterId`'s perspective. */
export function voteTargets(state: GameState, voterId: PlayerId): PlayerId[] {
  const pool = state.runoffTargets ?? activePlayers(state)
  return pool.filter((id) => id !== voterId && !state.eliminated.includes(id))
}

export function winningPlayers(state: GameState): PlayerId[] {
  if (state.winner === null) return []
  return state.winner === 'minority'
    ? [...state.minorityIds]
    : state.players.filter((id) => !isMinority(state, id))
}

// ------------------------------------------------------------ clue validation

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

/** NFKC + lowercase + diacritic-free, used for every content comparison. */
export const normalizeWord = (s: string) => stripDiacritics(s.normalize('NFKC').toLowerCase()).trim()

export const tokenize = (s: string) =>
  normalizeWord(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

export const MAX_CLUE_CODE_POINTS = 40

export type ClueRejection =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'TOO_MANY_WORDS'
  | 'NO_LETTERS'
  | 'CONTAINS_OWN_WORD'

/**
 * Checks a clue against the sender's own word only. Deliberately never compares
 * against the other secret word: doing so would turn submission into an oracle
 * that reveals what the other group holds. Simple token matching cannot
 * understand meaning, so players are also told to avoid obvious derivatives.
 */
export function validateClue(
  text: string,
  ownWord: string,
): { ok: true; text: string } | { ok: false; reason: ClueRejection } {
  const normalized = text.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (normalized.length === 0) return { ok: false, reason: 'EMPTY' }
  if ([...normalized].length > MAX_CLUE_CODE_POINTS) return { ok: false, reason: 'TOO_LONG' }
  if (normalized.split(' ').length > 3) return { ok: false, reason: 'TOO_MANY_WORDS' }

  const clueTokens = tokenize(normalized)
  if (clueTokens.length === 0) return { ok: false, reason: 'NO_LETTERS' }

  const ownTokens = new Set(tokenize(ownWord))
  if (clueTokens.some((t) => ownTokens.has(t))) return { ok: false, reason: 'CONTAINS_OWN_WORD' }

  return { ok: true, text: normalized }
}

// ---------------------------------------------------------------- transitions

export function startGame(
  players: readonly PlayerId[],
  settings: Settings,
  pair: WordPair,
  ctx: EngineContext,
): GameState {
  assertValidSetup(players.length, settings.minorityCount)
  if (new Set(players).size !== players.length) {
    throw new EngineError('INVALID_ROSTER', 'Duplicate player ids in roster.')
  }

  const minorityIds = sample(players, settings.minorityCount, ctx.rng)
  // Randomize which side of the pair the majority holds, so neither word is
  // systematically the minority's.
  const flipped = ctx.rng.nextInt(2) === 1

  return {
    phase: 'PRIVATE_REVEAL',
    players: [...players],
    settings,
    pair,
    majorityWord: flipped ? pair.wordB : pair.wordA,
    minorityWord: flipped ? pair.wordA : pair.wordB,
    minorityIds,
    acknowledged: [],
    eliminated: [],
    baseOrder: shuffle(players, ctx.rng),
    cycle: 1,
    turnIndex: 0,
    clues: [],
    earlyVoteRequestedBy: null,
    earlyVoteAccepts: [],
    votingRound: 'normal',
    runoffTargets: null,
    ballots: [],
    tallies: [],
    lastEliminated: null,
    winner: null,
    winReason: null,
    deadline: deadlineFrom(ctx.now, settings.revealSeconds),
  }
}

export function acknowledgeWord(state: GameState, playerId: PlayerId, ctx: EngineContext): GameState {
  if (state.phase !== 'PRIVATE_REVEAL') throw new EngineError('WRONG_PHASE')
  if (!state.players.includes(playerId)) throw new EngineError('NOT_A_PLAYER')
  // Repeat acknowledgments are safe by design; a retried delivery must not abort.
  const acknowledged = state.acknowledged.includes(playerId)
    ? state.acknowledged
    : [...state.acknowledged, playerId]

  if (acknowledged.length < state.players.length) return { ...state, acknowledged }
  return {
    ...state,
    acknowledged,
    phase: 'CLUES',
    deadline: deadlineFrom(ctx.now, state.settings.clueSeconds),
  }
}

/** Reveal deadline passed with someone unacknowledged: abort, no points. */
export function abortGame(state: GameState): GameState {
  return { ...state, phase: 'ABORTED', deadline: null, winner: null, winReason: null }
}

function afterClueTurn(state: GameState, clues: GameState['clues'], ctx: EngineContext): GameState {
  const next = state.turnIndex + 1
  if (next < cycleOrder(state).length) {
    return { ...state, clues, turnIndex: next, deadline: deadlineFrom(ctx.now, state.settings.clueSeconds) }
  }
  return {
    ...state,
    clues,
    turnIndex: next,
    phase: 'DISCUSSION',
    deadline: deadlineFrom(ctx.now, state.settings.discussionSeconds),
  }
}

export function submitClue(
  state: GameState,
  playerId: PlayerId,
  text: string,
  ctx: EngineContext,
): GameState {
  if (state.phase !== 'CLUES') throw new EngineError('WRONG_PHASE')
  if (currentSpeaker(state) !== playerId) throw new EngineError('NOT_YOUR_TURN')

  const result = validateClue(text, wordFor(state, playerId))
  if (!result.ok) throw new EngineError('INVALID_CLUE', result.reason)

  return afterClueTurn(state, [...state.clues, { cycle: state.cycle, playerId, text: result.text }], ctx)
}

/** Clue deadline expired: record a missed turn. Never eliminates anyone. */
export function skipClueTurn(state: GameState, ctx: EngineContext): GameState {
  if (state.phase !== 'CLUES') throw new EngineError('WRONG_PHASE')
  const speaker = currentSpeaker(state)
  if (speaker === null) throw new EngineError('WRONG_PHASE')
  return afterClueTurn(state, [...state.clues, { cycle: state.cycle, playerId: speaker, text: null }], ctx)
}

export function requestEarlyVote(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'DISCUSSION') throw new EngineError('WRONG_PHASE')
  if (!activePlayers(state).includes(playerId)) throw new EngineError('PLAYER_ELIMINATED')
  return { ...state, earlyVoteRequestedBy: playerId, earlyVoteAccepts: [playerId] }
}

export function acceptEarlyVote(state: GameState, playerId: PlayerId, ctx: EngineContext): GameState {
  if (state.phase !== 'DISCUSSION') throw new EngineError('WRONG_PHASE')
  if (state.earlyVoteRequestedBy === null) throw new EngineError('WRONG_PHASE')
  if (!activePlayers(state).includes(playerId)) throw new EngineError('PLAYER_ELIMINATED')

  const accepts = state.earlyVoteAccepts.includes(playerId)
    ? state.earlyVoteAccepts
    : [...state.earlyVoteAccepts, playerId]

  // Requires a strict majority of active players.
  if (accepts.length * 2 <= activePlayers(state).length) return { ...state, earlyVoteAccepts: accepts }
  return openVoting({ ...state, earlyVoteAccepts: accepts }, 'normal', null, ctx)
}

export function endDiscussion(state: GameState, ctx: EngineContext): GameState {
  if (state.phase !== 'DISCUSSION') throw new EngineError('WRONG_PHASE')
  return openVoting(state, 'normal', null, ctx)
}

function openVoting(
  state: GameState,
  round: VotingRound,
  runoffTargets: PlayerId[] | null,
  ctx: EngineContext,
): GameState {
  return {
    ...state,
    phase: 'VOTING',
    votingRound: round,
    runoffTargets,
    ballots: [],
    earlyVoteRequestedBy: null,
    earlyVoteAccepts: [],
    deadline: deadlineFrom(ctx.now, state.settings.votingSeconds),
  }
}

export function submitVote(
  state: GameState,
  voterId: PlayerId,
  targetId: PlayerId | null,
  ctx: EngineContext,
): GameState {
  if (state.phase !== 'VOTING') throw new EngineError('WRONG_PHASE')
  if (!activePlayers(state).includes(voterId)) throw new EngineError('PLAYER_ELIMINATED')
  if (state.ballots.some((b) => b.voterId === voterId)) throw new EngineError('ALREADY_VOTED')
  if (targetId === voterId) throw new EngineError('SELF_VOTE')
  if (targetId !== null && !voteTargets(state, voterId).includes(targetId)) {
    throw new EngineError('INVALID_VOTE_TARGET')
  }

  const ballots: Ballot[] = [...state.ballots, { voterId, targetId }]
  if (ballots.length < activePlayers(state).length) return { ...state, ballots }
  return closeVoting({ ...state, ballots }, ctx)
}

/** Called when every active player has voted, or the voting deadline expires. */
export function closeVoting(state: GameState, ctx: EngineContext): GameState {
  if (state.phase !== 'VOTING') throw new EngineError('WRONG_PHASE')

  const counts: Record<PlayerId, number> = {}
  let abstentions = 0
  for (const b of state.ballots) {
    if (b.targetId === null) abstentions++
    else counts[b.targetId] = (counts[b.targetId] ?? 0) + 1
  }
  // Anyone who never answered before the deadline counts as abstaining.
  abstentions += activePlayers(state).length - state.ballots.length

  const tallies = [...state.tallies, { cycle: state.cycle, round: state.votingRound, counts, abstentions }]
  const top = Math.max(0, ...Object.values(counts))
  const leaders = Object.keys(counts).filter((id) => counts[id] === top)

  // No non-abstaining votes at all: nobody goes out, and no runoff is held.
  if (top === 0) return resolve({ ...state, tallies }, null)
  if (leaders.length === 1) return resolve({ ...state, tallies }, leaders[0]!)
  // A first tie triggers exactly one runoff; a repeated tie eliminates nobody.
  if (state.votingRound === 'normal') return openVoting({ ...state, tallies }, 'runoff', leaders, ctx)
  return resolve({ ...state, tallies }, null)
}

/**
 * Applies the elimination and decides the game, in the order the rules require.
 * A runoff does not advance the cycle counter, so ties cannot extend a game.
 */
function resolve(state: GameState, eliminatedId: PlayerId | null): GameState {
  const eliminated = eliminatedId === null ? state.eliminated : [...state.eliminated, eliminatedId]
  const next: GameState = {
    ...state,
    eliminated,
    lastEliminated: eliminatedId,
    phase: 'RESOLUTION',
    runoffTargets: null,
    deadline: null,
  }

  const active = next.players.filter((id) => !eliminated.includes(id))
  const minorityLeft = active.filter((id) => isMinority(next, id)).length
  const majorityLeft = active.length - minorityLeft

  if (minorityLeft === 0) return { ...next, winner: 'majority', winReason: 'ALL_MINORITY_ELIMINATED' }
  if (minorityLeft >= majorityLeft) return { ...next, winner: 'minority', winReason: 'MINORITY_REACHED_PARITY' }
  if (next.cycle >= next.settings.maxCycles) {
    return { ...next, winner: 'minority', winReason: 'MINORITY_SURVIVED_CYCLE_LIMIT' }
  }
  return next
}

/** Leaves the neutral elimination screen for the next cycle or the results. */
export function advanceFromResolution(state: GameState, ctx: EngineContext): GameState {
  if (state.phase !== 'RESOLUTION') throw new EngineError('WRONG_PHASE')
  if (state.winner !== null) return { ...state, phase: 'RESULTS', deadline: null }
  return {
    ...state,
    phase: 'CLUES',
    cycle: state.cycle + 1,
    turnIndex: 0,
    votingRound: 'normal',
    ballots: [],
    lastEliminated: null,
    deadline: deadlineFrom(ctx.now, state.settings.clueSeconds),
  }
}

/**
 * Settles every transition whose deadline already passed — used after a server
 * restart. Each newly entered phase opens with a fresh full duration, so
 * downtime cannot silently burn through several playable phases.
 */
export function settleOverdue(state: GameState, ctx: EngineContext): GameState {
  let s = state
  // Bounded: one clue turn per player per cycle, so this cannot spin.
  for (let guard = 0; guard < 500; guard++) {
    if (s.deadline === null || s.deadline > ctx.now) return s
    switch (s.phase) {
      case 'PRIVATE_REVEAL':
        return s.acknowledged.length === s.players.length ? s : abortGame(s)
      case 'CLUES':
        s = skipClueTurn(s, ctx)
        break
      case 'DISCUSSION':
        s = endDiscussion(s, ctx)
        break
      case 'VOTING':
        s = closeVoting(s, ctx)
        break
      default:
        return s
    }
  }
  return s
}
