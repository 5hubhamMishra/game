export type PlayerId = string

/** LOBBY is pre-game; RESULTS and ABORTED are terminal. */
export type Phase =
  | 'LOBBY'
  | 'PRIVATE_REVEAL'
  | 'CLUES'
  | 'DISCUSSION'
  | 'VOTING'
  | 'RESOLUTION'
  | 'RESULTS'
  | 'ABORTED'

/** A runoff is a VOTING subtype with a restricted target set, not a new cycle. */
export type VotingRound = 'normal' | 'runoff'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type WordPair = {
  id: string
  locale: string
  category: string
  wordA: string
  wordB: string
  difficulty: Difficulty
  /** Internal editorial note on how the two differ. Never sent to clients. */
  note: string
  contentVersion: string
}

export type Settings = {
  minorityCount: number
  /** Seconds. `null` disables the deadline (permitted in local mode only). */
  clueSeconds: number | null
  discussionSeconds: number | null
  votingSeconds: number | null
  revealSeconds: number | null
  maxCycles: number
  categories: string[] | null
  difficulties: Difficulty[]
}

export const DEFAULT_SETTINGS: Settings = {
  minorityCount: 1,
  clueSeconds: 30,
  discussionSeconds: 90,
  votingSeconds: 30,
  revealSeconds: 120,
  maxCycles: 5,
  categories: null,
  difficulties: ['easy', 'medium'],
}

/** Local play passes one device around, so its reveal and votes are untimed. */
export const LOCAL_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  clueSeconds: null,
  votingSeconds: null,
  revealSeconds: null,
}

export type Clue = {
  cycle: number
  playerId: PlayerId
  /** `null` records a turn that expired without a submission. */
  text: string | null
}

/** `null` target is an abstention. Ballots stay private until RESULTS. */
export type Ballot = { voterId: PlayerId; targetId: PlayerId | null }

export type Winner = 'majority' | 'minority'

export type WinReasonCode =
  | 'ALL_MINORITY_ELIMINATED'
  | 'MINORITY_REACHED_PARITY'
  | 'MINORITY_SURVIVED_CYCLE_LIMIT'

/**
 * Authoritative game state. Everything secret lives here and is never handed to a
 * client wholesale — see the projections in @bw/contracts.
 */
export type GameState = {
  phase: Phase
  players: PlayerId[]
  settings: Settings
  pair: WordPair
  /** The word held by the majority. Orientation is randomized per game. */
  majorityWord: string
  minorityWord: string
  minorityIds: PlayerId[]
  acknowledged: PlayerId[]
  eliminated: PlayerId[]
  /** Fixed random speaking order; each cycle rotates its start by one. */
  baseOrder: PlayerId[]
  cycle: number
  turnIndex: number
  clues: Clue[]
  earlyVoteRequestedBy: PlayerId | null
  earlyVoteAccepts: PlayerId[]
  votingRound: VotingRound
  /** Restricted target set during a runoff; `null` in a normal round. */
  runoffTargets: PlayerId[] | null
  ballots: Ballot[]
  /** Aggregate tallies per completed round, kept for the results screen. */
  tallies: { cycle: number; round: VotingRound; counts: Record<PlayerId, number>; abstentions: number }[]
  lastEliminated: PlayerId | null
  winner: Winner | null
  winReason: WinReasonCode | null
  /** Absolute epoch ms for the current phase, or `null` when untimed. */
  deadline: number | null
}

export type EngineContext = {
  /** Epoch ms, supplied by the caller. The engine never reads a clock. */
  now: number
  rng: import('./rng.ts').Rng
}

export type ErrorCode =
  | 'INVALID_ROSTER'
  | 'INVALID_MINORITY_COUNT'
  | 'WRONG_PHASE'
  | 'NOT_A_PLAYER'
  | 'PLAYER_ELIMINATED'
  | 'NOT_YOUR_TURN'
  | 'ALREADY_SUBMITTED'
  | 'INVALID_CLUE'
  | 'INVALID_VOTE_TARGET'
  | 'SELF_VOTE'
  | 'ALREADY_VOTED'
  | 'NOT_ENOUGH_ACCEPTS'
  | 'GAME_OVER'

export class EngineError extends Error {
  constructor(readonly code: ErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'EngineError'
  }
}
