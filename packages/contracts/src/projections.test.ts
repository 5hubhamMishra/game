import { describe, expect, it } from 'vitest'
import { publicRoomViewSchema, resultsViewSchema, selfViewSchema } from './index.ts'

const room = {
  roomCode: 'ABC123', hostId: 'p1', phase: 'CLUES' as const, revision: 4,
  players: [{ id: 'p1', name: 'Alex', ready: true, connected: true, eliminated: false }],
  clues: [{ cycle: 1, playerId: 'p1', text: 'Warm' }], discussion: [], deadline: null,
  voting: null, earlyVoteRequest: null,
}

describe('wire projections', () => {
  it('accepts the public allowlist', () => expect(publicRoomViewSchema.parse(room)).toEqual(room))
  it('keeps a self word opt-in and never needs the alternative word', () => {
    expect(selfViewSchema.parse({ ...room, self: { playerId: 'p1', acknowledged: false, word: null } }).self.word).toBeNull()
  })
  it('requires results to be terminal and explicit', () => {
    expect(resultsViewSchema.parse({
      roomCode: 'ABC123', revision: 8, phase: 'RESULTS', wordA: 'Purse', wordB: 'Wallet', majorityWord: 'Purse',
      assignments: [{ playerId: 'p1', word: 'Purse', group: 'majority' }], tallies: [], winner: 'majority',
      reason: 'ALL_MINORITY_ELIMINATED', scores: { p1: 1 },
    }).phase).toBe('RESULTS')
  })
})
