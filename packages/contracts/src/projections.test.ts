import { describe, expect, it } from 'vitest'
import { publicRoomViewSchema, resultsViewSchema, selfViewSchema } from './index.ts'

const room = {
  roomCode: 'ABC123', hostId: 'p1', phase: 'CLUES' as const, cycle: 1, maxCycles: 5, revision: 4, settings: { minorityCount: 1 },
  players: [{ id: 'p1', name: 'Alex', ready: true, connected: true, eliminated: false }],
  clues: [{ cycle: 1, playerId: 'p1', text: 'Warm' }], discussion: [], deadline: null,
  voting: null, earlyVoteRequest: null,
}

describe('wire projections', () => {
  it('accepts the public allowlist', () => expect(publicRoomViewSchema.parse(room)).toEqual(room))
  it('keeps a self word opt-in and never needs the alternative word', () => {
    expect(selfViewSchema.parse({ ...room, self: { playerId: 'p1', acknowledged: false, word: null } }).self.word).toBeNull()
  })
  it('strips secret fields from non-terminal projections', () => {
    const raw = { ...room, minorityWord: 'Wallet', minorityIds: ['p1'], pairId: 'secret-pair' }
    const publicView = publicRoomViewSchema.parse(raw)
    const selfView = selfViewSchema.parse({ ...raw, self: { playerId: 'p1', acknowledged: false, word: null } })
    expect(publicView).not.toHaveProperty('minorityWord')
    expect(publicView).not.toHaveProperty('minorityIds')
    expect(publicView).not.toHaveProperty('pairId')
    expect(selfView).not.toHaveProperty('minorityWord')
    expect(selfView).not.toHaveProperty('minorityIds')
    expect(selfView).not.toHaveProperty('pairId')
  })
  it('requires results to be terminal and explicit', () => {
    const result = resultsViewSchema.parse({
      roomCode: 'ABC123', revision: 8, phase: 'RESULTS', wordA: 'Purse', wordB: 'Wallet', majorityWord: 'Purse',
      assignments: [{ playerId: 'p1', word: 'Purse', group: 'majority' }], tallies: [], winner: 'majority',
      reason: 'ALL_MINORITY_ELIMINATED', scores: { p1: 1 },
      ballots: [{ voterId: 'p1', targetId: 'p2' }],
    })
    expect(result.phase).toBe('RESULTS')
    expect(result).not.toHaveProperty('ballots')
  })
})
