import { describe, expect, it } from 'vitest'

describe('game server boundary', () => {
  it('has a dedicated service entry point', async () => {
    const module = await import('./index.ts').catch(() => null)
    expect(module).not.toBeNull()
  })
})
