import { z } from 'zod'

export const phaseSchema = z.enum([
  'LOBBY', 'PRIVATE_REVEAL', 'CLUES', 'DISCUSSION', 'VOTING', 'RESOLUTION', 'RESULTS', 'ABORTED',
])
export const votingRoundSchema = z.enum(['normal', 'runoff'])
export const difficultySchema = z.enum(['easy', 'medium', 'hard'])

export const publicPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  ready: z.boolean(),
  connected: z.boolean(),
  eliminated: z.boolean(),
})

export const publicClueSchema = z.object({
  cycle: z.number().int().positive(),
  playerId: z.string().min(1),
  text: z.string().max(40).nullable(),
})

export const discussionMessageSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  text: z.string().max(280),
  createdAt: z.number().int().nonnegative(),
})

export const publicRoomViewSchema = z.object({
  roomCode: z.string().length(6),
  hostId: z.string().min(1),
  phase: phaseSchema,
  revision: z.number().int().nonnegative(),
  players: z.array(publicPlayerSchema),
  clues: z.array(publicClueSchema),
  discussion: z.array(discussionMessageSchema),
  deadline: z.number().int().positive().nullable(),
  voting: z.object({
    round: votingRoundSchema,
    submitted: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
  }).nullable(),
  earlyVoteRequest: z.string().min(1).nullable(),
})
export type PublicRoomView = z.infer<typeof publicRoomViewSchema>

export const selfViewSchema = publicRoomViewSchema.extend({
  self: z.object({
    playerId: z.string().min(1),
    acknowledged: z.boolean(),
    word: z.string().min(1).max(100).nullable(),
  }),
})
export type SelfView = z.infer<typeof selfViewSchema>

export const resultsViewSchema = z.object({
  roomCode: z.string().length(6),
  revision: z.number().int().nonnegative(),
  phase: z.literal('RESULTS'),
  wordA: z.string().min(1),
  wordB: z.string().min(1),
  majorityWord: z.string().min(1),
  assignments: z.array(z.object({ playerId: z.string().min(1), word: z.string().min(1), group: z.enum(['majority', 'minority']) })),
  tallies: z.array(z.object({ cycle: z.number().int().positive(), round: votingRoundSchema, counts: z.record(z.string(), z.number().int().nonnegative()), abstentions: z.number().int().nonnegative() })),
  winner: z.enum(['majority', 'minority']),
  reason: z.enum(['ALL_MINORITY_ELIMINATED', 'MINORITY_REACHED_PARITY', 'MINORITY_SURVIVED_CYCLE_LIMIT']),
  scores: z.record(z.string(), z.number().int().nonnegative()),
})
export type ResultsView = z.infer<typeof resultsViewSchema>

export const actionEnvelopeSchema = z.object({
  eventId: z.string().min(16).max(128),
  expectedRevision: z.number().int().nonnegative().optional(),
})

export const socketActions = {
  setReady: actionEnvelopeSchema.extend({ ready: z.boolean() }),
  acknowledgeWord: actionEnvelopeSchema,
  submitClue: actionEnvelopeSchema.extend({ text: z.string().trim().min(1).max(40) }),
  postDiscussion: actionEnvelopeSchema.extend({ text: z.string().trim().min(1).max(280) }),
  requestEarlyVote: actionEnvelopeSchema,
  acceptEarlyVote: actionEnvelopeSchema,
  submitVote: actionEnvelopeSchema.extend({ targetId: z.string().min(1).nullable() }),
  startGame: actionEnvelopeSchema,
  cancelGame: actionEnvelopeSchema,
  requestRematch: actionEnvelopeSchema,
} as const

export type SocketActionName = keyof typeof socketActions
