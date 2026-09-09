import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  EngineError,
  type GameState,
  type PlayerId,
  type Settings,
  type WordPair,
  abortGame,
  acceptEarlyVote,
  acknowledgeWord,
  activePlayers,
  advanceFromResolution,
  assertValidSetup,
  closeVoting,
  currentSpeaker,
  cycleOrder,
  endDiscussion,
  isMinority,
  maxMinorityCount,
  requestEarlyVote,
  sample,
  secureRng,
  seededRng,
  settleOverdue,
  shuffle,
  skipClueTurn,
  startGame,
  submitClue,
  submitVote,
  validateClue,
  voteTargets,
  winningPlayers,
  wordFor,
} from './index.ts'

const PAIR: WordPair = {
  id: 'test-001',
  locale: 'en',
  category: 'drinks',
  wordA: 'cappuccino',
  wordB: 'latte',
  difficulty: 'easy',
  note: 'Foam ratio differs; both are espresso and steamed milk.',
  contentVersion: 'test',
}

const roster = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function ctx(seed = 1, now = 0) {
  return { now, rng: seededRng(seed) }
}

/** Drives a fresh game to the CLUES phase with everyone acknowledged. */
function started(n: number, overrides: Partial<Settings> = {}, seed = 1): GameState {
  const settings = { ...DEFAULT_SETTINGS, ...overrides }
  let s = startGame(roster(n), settings, PAIR, ctx(seed))
  for (const id of s.players) s = acknowledgeWord(s, id, ctx(seed))
  return s
}

/** Plays out one full clue round so the game lands in DISCUSSION. */
function throughClues(state: GameState): GameState {
  let s = state
  while (s.phase === 'CLUES') s = skipClueTurn(s, ctx())
  return s
}

/** Everyone active votes for `target` (or abstains when null). */
function allVote(state: GameState, choose: (voter: PlayerId) => PlayerId | null): GameState {
  let s = state
  for (const voter of activePlayers(state)) {
    if (s.phase !== 'VOTING') break
    s = submitVote(s, voter, choose(voter), ctx())
  }
  return s
}

// ------------------------------------------------------------------ rng

describe('rng', () => {
  it('rejects non-positive bounds', () => {
    expect(() => seededRng(1).nextInt(0)).toThrow(RangeError)
    expect(() => secureRng().nextInt(-1)).toThrow(RangeError)
  })

  it('stays inside the requested bound', () => {
    const rng = seededRng(42)
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextInt(7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(7)
    }
  })

  it('produces a roughly flat distribution rather than a biased tail', () => {
    const rng = secureRng()
    const buckets = new Array(5).fill(0)
    const draws = 50_000
    for (let i = 0; i < draws; i++) buckets[rng.nextInt(5)]++
    // Each bucket should sit near 20%; a modulo-biased generator drifts far wider.
    for (const count of buckets) expect(Math.abs(count / draws - 0.2)).toBeLessThan(0.02)
  })

  it('shuffles without mutating or losing elements', () => {
    const input = roster(8)
    const out = shuffle(input, seededRng(3))
    expect(input).toEqual(roster(8))
    expect([...out].sort()).toEqual([...input].sort())
  })

  it('refuses to sample more than it has', () => {
    expect(() => sample(roster(3), 4, seededRng(1))).toThrow(RangeError)
  })
})

// -------------------------------------------------------------- setup rules

describe('setup validation', () => {
  it('caps K at min(3, floor((N-1)/2))', () => {
    expect(maxMinorityCount(3)).toBe(1)
    expect(maxMinorityCount(4)).toBe(1)
    expect(maxMinorityCount(5)).toBe(2)
    expect(maxMinorityCount(7)).toBe(3)
    expect(maxMinorityCount(24)).toBe(3)
  })

  it('enforces 1 <= K and 2K < N', () => {
    expect(() => assertValidSetup(3, 1)).toThrow(EngineError)
    expect(() => assertValidSetup(4, 0)).toThrow(EngineError)
    expect(() => assertValidSetup(4, 2)).toThrow(EngineError) // 2K == N
    expect(() => assertValidSetup(5, 2)).not.toThrow()
    expect(() => assertValidSetup(4, 1)).not.toThrow()
  })

  it('rejects a roster with duplicate ids', () => {
    expect(() => startGame(['a', 'a', 'b'], DEFAULT_SETTINGS, PAIR, ctx())).toThrow(EngineError)
  })
})

// -------------------------------------------------------------- assignments

describe('assignment', () => {
  it('assigns exactly K minority players and one of two words to everyone', () => {
    for (const [n, k] of [[4, 1], [5, 2], [7, 3], [10, 3]] as const) {
      const s = started(n, { minorityCount: k })
      expect(s.minorityIds).toHaveLength(k)
      expect(new Set(s.minorityIds).size).toBe(k)
      const words = s.players.map((id) => wordFor(s, id))
      expect(new Set(words)).toEqual(new Set([s.majorityWord, s.minorityWord]))
      expect(words.filter((w) => w === s.minorityWord)).toHaveLength(k)
    }
  })

  it('uses both words from the pair and never the same word twice', () => {
    const s = started(5)
    expect(new Set([s.majorityWord, s.minorityWord])).toEqual(new Set([PAIR.wordA, PAIR.wordB]))
  })

  it('randomizes orientation so neither side is always the minority word', () => {
    const orientations = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) orientations.add(started(5, {}, seed).minorityWord)
    expect(orientations).toEqual(new Set([PAIR.wordA, PAIR.wordB]))
  })

  it('does not correlate the speaking order with the minority group', () => {
    // If the base order leaked roles, the minority would cluster at a fixed index.
    const firstIsMinority: boolean[] = []
    for (let seed = 1; seed <= 80; seed++) {
      const s = started(6, {}, seed)
      firstIsMinority.push(isMinority(s, s.baseOrder[0]!))
    }
    expect(firstIsMinority).toContain(true)
    expect(firstIsMinority).toContain(false)
  })
})

// ------------------------------------------------------------------ reveal

describe('private reveal', () => {
  it('advances to clues only once every player acknowledges', () => {
    let s = startGame(roster(4), DEFAULT_SETTINGS, PAIR, ctx())
    expect(s.phase).toBe('PRIVATE_REVEAL')
    s = acknowledgeWord(s, 'p1', ctx())
    s = acknowledgeWord(s, 'p1', ctx()) // repeat delivery is safe
    expect(s.acknowledged).toEqual(['p1'])
    expect(s.phase).toBe('PRIVATE_REVEAL')
    for (const id of ['p2', 'p3', 'p4']) s = acknowledgeWord(s, id, ctx())
    expect(s.phase).toBe('CLUES')
  })

  it('aborts without a winner when the reveal deadline passes unacknowledged', () => {
    let s = startGame(roster(4), DEFAULT_SETTINGS, PAIR, ctx(1, 0))
    s = acknowledgeWord(s, 'p1', ctx())
    s = settleOverdue(s, { now: 999_999, rng: seededRng(1) })
    expect(s.phase).toBe('ABORTED')
    expect(s.winner).toBeNull()
    expect(winningPlayers(s)).toEqual([])
  })

  it('rejects an acknowledgment from a non-player', () => {
    const s = startGame(roster(4), DEFAULT_SETTINGS, PAIR, ctx())
    expect(() => acknowledgeWord(s, 'intruder', ctx())).toThrow(EngineError)
    expect(() => wordFor(s, 'intruder')).toThrow(EngineError)
  })
})

// -------------------------------------------------------------------- clues

describe('clue validation', () => {
  const own = 'ice cream'

  it('accepts one to three words', () => {
    expect(validateClue('cold', own)).toEqual({ ok: true, text: 'cold' })
    expect(validateClue('  cold   sweet  treat ', own)).toEqual({ ok: true, text: 'cold sweet treat' })
    expect(validateClue('a b c d', own)).toEqual({ ok: false, reason: 'TOO_MANY_WORDS' })
  })

  it('rejects empty and punctuation-only input', () => {
    expect(validateClue('   ', own)).toEqual({ ok: false, reason: 'EMPTY' })
    expect(validateClue('!!! ???', own)).toEqual({ ok: false, reason: 'NO_LETTERS' })
  })

  it('rejects more than 40 code points', () => {
    expect(validateClue('a'.repeat(41), own)).toEqual({ ok: false, reason: 'TOO_LONG' })
    expect(validateClue('a'.repeat(40), own).ok).toBe(true)
  })

  it('rejects any complete token of the sender own word, case and accent insensitive', () => {
    expect(validateClue('ICE', own)).toEqual({ ok: false, reason: 'CONTAINS_OWN_WORD' })
    expect(validateClue('creamy cream', own)).toEqual({ ok: false, reason: 'CONTAINS_OWN_WORD' })
    expect(validateClue('café', 'cafe')).toEqual({ ok: false, reason: 'CONTAINS_OWN_WORD' })
    // A partial overlap is not a whole token, so it stands.
    expect(validateClue('creamy', own).ok).toBe(true)
  })

  it('never consults the other secret word', () => {
    // 'latte' is the other side of the pair and must remain submittable, or the
    // rejection itself would tell the sender what the other group holds.
    expect(validateClue('latte', 'cappuccino').ok).toBe(true)
  })
})

describe('clue turns', () => {
  it('gives each active player exactly one turn per cycle', () => {
    let s = started(5)
    const order = cycleOrder(s)
    expect(order).toHaveLength(5)
    const spoke: PlayerId[] = []
    while (s.phase === 'CLUES') {
      spoke.push(currentSpeaker(s)!)
      s = skipClueTurn(s, ctx())
    }
    expect(spoke).toEqual(order)
    expect(s.phase).toBe('DISCUSSION')
  })

  it('rotates the first speaker by one each cycle, preserving relative order', () => {
    const s = started(5)
    const c1 = cycleOrder(s)
    const c2 = cycleOrder({ ...s, cycle: 2 })
    expect(c2[0]).toBe(c1[1])
    expect(c2).toEqual([...c1.slice(1), c1[0]])
  })

  it('filters eliminated players while preserving relative order', () => {
    const s = started(5)
    const base = cycleOrder(s)
    const gone = base[2]!
    const after = cycleOrder({ ...s, eliminated: [gone] })
    expect(after).toEqual(base.filter((id) => id !== gone))
  })

  it('rejects a clue from anyone but the current speaker', () => {
    const s = started(4)
    const other = s.players.find((id) => id !== currentSpeaker(s))!
    expect(() => submitClue(s, other, 'hello', ctx())).toThrow(EngineError)
  })

  it('records a missed turn without eliminating anyone', () => {
    const s = started(4)
    const speaker = currentSpeaker(s)!
    const next = skipClueTurn(s, ctx())
    expect(next.clues[0]).toEqual({ cycle: 1, playerId: speaker, text: null })
    expect(next.eliminated).toEqual([])
  })

  it('stores an accepted clue with its cycle and author', () => {
    const s = started(4)
    const speaker = currentSpeaker(s)!
    const next = submitClue(s, speaker, 'warm drink', ctx())
    expect(next.clues[0]).toEqual({ cycle: 1, playerId: speaker, text: 'warm drink' })
  })
})

// --------------------------------------------------------------- discussion

describe('discussion', () => {
  it('opens voting only on a strict majority of active players', () => {
    let s = throughClues(started(5))
    expect(s.phase).toBe('DISCUSSION')
    s = requestEarlyVote(s, 'p1')
    s = acceptEarlyVote(s, 'p2', ctx())
    expect(s.phase).toBe('DISCUSSION') // 2 of 5 is not a majority
    s = acceptEarlyVote(s, 'p3', ctx())
    expect(s.phase).toBe('VOTING') // 3 of 5 is
  })

  it('ignores a duplicate acceptance', () => {
    let s = requestEarlyVote(throughClues(started(5)), 'p1')
    s = acceptEarlyVote(s, 'p2', ctx())
    s = acceptEarlyVote(s, 'p2', ctx())
    expect(s.earlyVoteAccepts).toEqual(['p1', 'p2'])
    expect(s.phase).toBe('DISCUSSION')
  })

  it('refuses an eliminated player a request or acceptance', () => {
    const s = { ...throughClues(started(5)), eliminated: ['p1'] }
    expect(() => requestEarlyVote(s, 'p1')).toThrow(EngineError)
  })
})

// ------------------------------------------------------------------ voting

describe('voting', () => {
  const toVoting = (n = 5, overrides: Partial<Settings> = {}, seed = 1) =>
    endDiscussion(throughClues(started(n, overrides, seed)), ctx())

  it('forbids self-votes and votes for eliminated players', () => {
    const s = toVoting()
    expect(() => submitVote(s, 'p1', 'p1', ctx())).toThrow(EngineError)
    const withGone = { ...s, eliminated: ['p5'] }
    expect(voteTargets(withGone, 'p1')).not.toContain('p5')
    expect(() => submitVote(withGone, 'p1', 'p5', ctx())).toThrow(EngineError)
  })

  it('locks a ballot once confirmed', () => {
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    expect(() => submitVote(s, 'p1', 'p3', ctx())).toThrow(EngineError)
  })

  it('eliminates a unique plurality without needing a majority', () => {
    // p2 takes two votes; p3 and p4 take one each. No absolute majority.
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    s = submitVote(s, 'p3', 'p2', ctx())
    s = submitVote(s, 'p2', 'p3', ctx())
    s = submitVote(s, 'p4', 'p5', ctx())
    s = submitVote(s, 'p5', 'p4', ctx())
    expect(s.phase).toBe('RESOLUTION')
    expect(s.lastEliminated).toBe('p2')
  })

  it('counts unanswered ballots at the deadline as abstentions', () => {
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    s = closeVoting(s, ctx()) // deadline with four players silent
    const tally = s.tallies.at(-1)!
    expect(tally.counts).toEqual({ p2: 1 })
    expect(tally.abstentions).toBe(4)
    expect(s.lastEliminated).toBe('p2')
  })

  it('eliminates nobody and holds no runoff when every ballot abstains', () => {
    let s = toVoting()
    s = allVote(s, () => null)
    expect(s.phase).toBe('RESOLUTION')
    expect(s.lastEliminated).toBeNull()
    expect(s.eliminated).toEqual([])
    expect(s.tallies).toHaveLength(1)
  })

  it('holds exactly one runoff on a tie, restricted to the tied players', () => {
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    s = submitVote(s, 'p2', 'p3', ctx())
    s = submitVote(s, 'p3', 'p2', ctx())
    s = submitVote(s, 'p4', 'p3', ctx())
    s = submitVote(s, 'p5', null, ctx())
    expect(s.phase).toBe('VOTING')
    expect(s.votingRound).toBe('runoff')
    expect(new Set(s.runoffTargets!)).toEqual(new Set(['p2', 'p3']))
    expect(s.ballots).toEqual([])
    // A tied player may still vote, just not for themselves.
    expect(voteTargets(s, 'p2')).toEqual(['p3'])
    expect(voteTargets(s, 'p1').sort()).toEqual(['p2', 'p3'])
  })

  it('eliminates nobody when the runoff ties again', () => {
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    s = submitVote(s, 'p2', 'p3', ctx())
    s = submitVote(s, 'p3', 'p2', ctx())
    s = submitVote(s, 'p4', 'p3', ctx())
    s = submitVote(s, 'p5', null, ctx())
    expect(s.votingRound).toBe('runoff')
    s = submitVote(s, 'p1', 'p2', ctx())
    s = submitVote(s, 'p4', 'p3', ctx())
    s = submitVote(s, 'p2', 'p3', ctx())
    s = submitVote(s, 'p3', 'p2', ctx())
    s = submitVote(s, 'p5', null, ctx())
    expect(s.phase).toBe('RESOLUTION')
    expect(s.lastEliminated).toBeNull()
    expect(s.eliminated).toEqual([])
  })

  it('does not advance the cycle across a runoff', () => {
    let s = toVoting()
    s = submitVote(s, 'p1', 'p2', ctx())
    s = submitVote(s, 'p2', 'p3', ctx())
    s = submitVote(s, 'p3', 'p2', ctx())
    s = submitVote(s, 'p4', 'p3', ctx())
    s = submitVote(s, 'p5', null, ctx())
    expect(s.cycle).toBe(1)
    s = allVote(s, () => null)
    expect(s.cycle).toBe(1)
    s = advanceFromResolution(s, ctx())
    expect(s.cycle).toBe(2)
  })

  it('publishes aggregate counts but never who voted for whom', () => {
    let s = toVoting()
    s = allVote(s, (v) => (v === 'p1' ? null : 'p1'))
    const tally = s.tallies.at(-1)!
    expect(Object.keys(tally)).toEqual(['cycle', 'round', 'counts', 'abstentions'])
    expect(tally.counts).toEqual({ p1: 4 })
  })
})

// -------------------------------------------------------- outcomes and scoring

describe('outcomes', () => {
  /** Eliminates `target` through a real vote, from the CLUES phase. */
  function eliminate(state: GameState, target: PlayerId): GameState {
    let s = endDiscussion(throughClues(state), ctx())
    return allVote(s, (v) => (v === target ? null : target))
  }

  it('gives the majority the win once every minority player is out', () => {
    let s = started(5, { minorityCount: 1 })
    s = eliminate(s, s.minorityIds[0]!)
    expect(s.winner).toBe('majority')
    expect(s.winReason).toBe('ALL_MINORITY_ELIMINATED')
    expect(winningPlayers(s).sort()).toEqual(
      s.players.filter((id) => !isMinority(s, id)).sort(),
    )
  })

  it('gives the minority the win at parity', () => {
    // 5 players, K=2. Removing one majority player leaves 2 v 2.
    let s = started(5, { minorityCount: 2 })
    const majority = s.players.filter((id) => !isMinority(s, id))
    s = eliminate(s, majority[0]!)
    expect(s.winner).toBe('minority')
    expect(s.winReason).toBe('MINORITY_REACHED_PARITY')
  })

  it('checks elimination before parity when the last minority player goes out', () => {
    // 4 players, K=1: removing the minority leaves 0 v 3, not parity.
    let s = started(4, { minorityCount: 1 })
    s = eliminate(s, s.minorityIds[0]!)
    expect(s.winner).toBe('majority')
  })

  it('gives a 5-player, two-minority game to the minority at parity', () => {
    let s = started(5, { minorityCount: 2 })
    const majority = s.players.filter((id) => !isMinority(s, id))
    s = eliminate(s, majority[0]!)
    expect(s.winner).toBe('minority')
    expect(s.winReason).toBe('MINORITY_REACHED_PARITY')
  })

  it('gives the minority a survival win at the cycle limit', () => {
    let s = started(9, { minorityCount: 1, maxCycles: 5 })
    for (let cycle = 1; cycle <= 5; cycle++) {
      expect(s.cycle).toBe(cycle)
      s = endDiscussion(throughClues(s), ctx())
      s = allVote(s, () => null) // nobody eliminated, so the game runs its length
      if (cycle < 5) {
        expect(s.winner).toBeNull()
        s = advanceFromResolution(s, ctx())
      }
    }
    expect(s.winner).toBe('minority')
    expect(s.winReason).toBe('MINORITY_SURVIVED_CYCLE_LIMIT')
    expect(advanceFromResolution(s, ctx()).phase).toBe('RESULTS')
  })

  it('keeps clues and elimination in the same game across multiple cycles', () => {
    let s = started(4, { maxCycles: 3 })
    for (const cycle of [1, 2]) {
      expect(s.cycle).toBe(cycle)
      s = endDiscussion(throughClues(s), ctx())
      s = allVote(s, () => null)
      expect(s.phase).toBe('RESOLUTION')
      expect(s.clues.filter((clue) => clue.cycle === cycle)).toHaveLength(4)
      s = advanceFromResolution(s, ctx())
    }
    expect(s.cycle).toBe(3)
    expect(s.phase).toBe('CLUES')
  })

  it('awards an eliminated teammate alongside the survivors', () => {
    // 7 players, K=3. One minority player goes out first, then two majority
    // players, leaving 2 v 2 parity — a minority win the eliminated player shares.
    let s = started(7, { minorityCount: 3 })
    const majority = s.players.filter((id) => !isMinority(s, id))
    const lostTeammate = s.minorityIds[0]!

    s = eliminate(s, lostTeammate)
    expect(s.winner).toBeNull()
    s = advanceFromResolution(s, ctx())
    s = eliminate(s, majority[0]!)
    expect(s.winner).toBeNull()
    s = advanceFromResolution(s, ctx())
    s = eliminate(s, majority[1]!)

    expect(s.winner).toBe('minority')
    expect(s.winReason).toBe('MINORITY_REACHED_PARITY')
    expect(s.eliminated).toContain(lostTeammate)
    expect(winningPlayers(s)).toContain(lostTeammate)
    expect(winningPlayers(s).sort()).toEqual([...s.minorityIds].sort())
  })

  it('reveals nothing about an eliminated player group', () => {
    let s = started(5)
    s = eliminate(s, 'p1')
    // The state marks who is out and nothing about which side they were on.
    expect(s.eliminated).toEqual(['p1'])
    expect(s.lastEliminated).toBe('p1')
  })

  it('awards nobody for an aborted game', () => {
    const s = abortGame(started(5))
    expect(s.phase).toBe('ABORTED')
    expect(winningPlayers(s)).toEqual([])
  })
})

// ------------------------------------------------------------ restart recovery

describe('deadline recovery', () => {
  it('settles one overdue transition and reopens with a full fresh duration', () => {
    const s = started(5, { clueSeconds: 30 })
    const later = 10 * 60_000
    const settled = settleOverdue(s, { now: later, rng: seededRng(1) })
    // Exactly one turn was skipped, not the whole cycle.
    expect(settled.clues).toHaveLength(1)
    expect(settled.phase).toBe('CLUES')
    expect(settled.deadline).toBe(later + 30_000)
  })

  it('leaves an untimed local game untouched', () => {
    const s = started(5, { clueSeconds: null, revealSeconds: null })
    expect(settleOverdue(s, { now: 9_999_999, rng: seededRng(1) })).toBe(s)
  })

  it('leaves a terminal game untouched', () => {
    const s = { ...started(5), phase: 'RESULTS' as const, deadline: 1 }
    expect(settleOverdue(s, { now: 9_999_999, rng: seededRng(1) }).phase).toBe('RESULTS')
  })
})

// ------------------------------------------------------------ phase guarding

describe('phase guards', () => {
  it('refuses actions that belong to another phase', () => {
    const reveal = startGame(roster(4), DEFAULT_SETTINGS, PAIR, ctx())
    expect(() => submitClue(reveal, 'p1', 'x', ctx())).toThrow(EngineError)
    expect(() => submitVote(reveal, 'p1', 'p2', ctx())).toThrow(EngineError)
    expect(() => endDiscussion(reveal, ctx())).toThrow(EngineError)
    expect(() => advanceFromResolution(reveal, ctx())).toThrow(EngineError)

    const clues = started(4)
    expect(() => acknowledgeWord(clues, 'p1', ctx())).toThrow(EngineError)
    expect(() => closeVoting(clues, ctx())).toThrow(EngineError)
  })
})
