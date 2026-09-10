import { describe, expect, it } from 'vitest'

describe('game server boundary', () => {
  it('never supplies a development service token in production', async () => {
    const { serviceTokenFor } = await import('./index.ts')
    expect(serviceTokenFor('production', undefined)).toBeNull()
    expect(serviceTokenFor('production', '  ')).toBeNull()
    expect(serviceTokenFor('development', undefined)).toBe('dev-service-token')
    expect(serviceTokenFor('production', 'configured-secret')).toBe('configured-secret')
  })

  it('formats safe HTTP errors as problem details', async () => {
    const { problemDetails } = await import('./index.ts')
    expect(problemDetails(429, 'RATE_LIMITED')).toEqual({
      type: 'urn:between-words:error:rate_limited',
      title: 'Request failed',
      status: 429,
      code: 'RATE_LIMITED',
    })
  })

  it('has a dedicated service entry point', async () => {
    const module = await import('./index.ts').catch(() => null)
    expect(module).not.toBeNull()
  })

  it('exposes the authenticated room action contract', async () => {
    const { socketActions } = await import('@bw/contracts')
    expect(socketActions.joinRoom.safeParse({ eventId: 'event-123456789012', roomCode: 'ABC234' }).success).toBe(true)
    expect(socketActions.revealWord.safeParse({ eventId: 'event-123456789012' }).success).toBe(true)
    expect(socketActions.removeMember.safeParse({ eventId: 'event-123456789012', playerId: 'player-2' }).success).toBe(true)
    expect(socketActions.removeMember.safeParse({ eventId: 'event-123456789012', playerId: '' }).success).toBe(false)
  })
})
