import { describe, expect, it } from 'vitest'

describe('game server boundary', () => {
  it('has a dedicated service entry point', async () => {
    const module = await import('./index.ts').catch(() => null)
    expect(module).not.toBeNull()
  })

  it('exposes the authenticated room action contract', async () => {
    const { socketActions } = await import('@bw/contracts')
    expect(socketActions.joinRoom.safeParse({ eventId: 'event-123456789012', roomCode: 'ABC234' }).success).toBe(true)
    expect(socketActions.revealWord.safeParse({ eventId: 'event-123456789012' }).success).toBe(true)
  })
})
