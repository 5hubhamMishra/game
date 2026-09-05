import { describe, expect, it } from 'vitest'
import { seededRng } from '@bw/game-core'
import { CATALOG, CATEGORIES, filterPairs, findPair, parseCustomPairs, pickPair } from './index.ts'
import { pairId, pairKey } from './schema.ts'
import { validate } from './validate.ts'

describe('catalog', () => {
  it('passes the content gate with no errors', () => {
    expect(validate()).toEqual([])
  })

  it('has ten categories and at least five hundred pairs', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(10)
    expect(CATALOG.length).toBeGreaterThanOrEqual(500)
  })

  it('stores cappuccino and latte as the coffee pair', () => {
    const pair = CATALOG.find((p) => p.wordA === 'Cappuccino')
    expect(pair?.wordB).toBe('Latte')
    expect(pair?.category).toBe('drinks')
  })

  it('treats a pair as unordered', () => {
    expect(pairKey('Purse', 'Wallet')).toBe(pairKey('wallet', 'purse'))
    expect(pairId('Purse', 'Wallet')).toBe(pairId('Wallet', 'Purse'))
  })

  it('gives opaque ids that do not leak the words', () => {
    const id = pairId('Cappuccino', 'Latte')
    expect(id).toMatch(/^[0-9a-f]{12}$/)
    expect(id).not.toContain('lat')
  })

  it('finds a pair by id', () => {
    const first = CATALOG[0]!
    expect(findPair(first.id)).toEqual(first)
    expect(findPair('deadbeefcafe')).toBeUndefined()
  })
})

describe('selection', () => {
  it('filters by difficulty and category', () => {
    const pool = filterPairs({ difficulties: ['easy'], categories: ['animals'] })
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((p) => p.difficulty === 'easy' && p.category === 'animals')).toBe(true)
  })

  it('never returns an excluded pair', () => {
    const excluded = filterPairs({ categories: ['music'] }).map((p) => p.id)
    const rng = seededRng(7)
    for (let i = 0; i < 50; i++) {
      const pick = pickPair(rng, { categories: ['music'], excludeIds: excluded })
      expect(pick).toBeUndefined()
    }
  })

  it('picks reproducibly from a seed', () => {
    expect(pickPair(seededRng(42))!.id).toBe(pickPair(seededRng(42))!.id)
  })
})

describe('custom pairs', () => {
  it('parses rows and skips the header', () => {
    const { pairs, issues } = parseCustomPairs(
      'wordA,wordB,category,difficulty\nSpoon,Ladle,kitchen,easy\nKite,Drone,toys,medium\n',
    )
    expect(issues).toEqual([])
    expect(pairs.map((p) => p.wordB)).toEqual(['Ladle', 'Drone'])
    expect(pairs[0]!.category).toBe('kitchen')
  })

  it('defaults category and difficulty', () => {
    const { pairs } = parseCustomPairs('Salt,Pepper')
    expect(pairs[0]!.category).toBe('custom')
    expect(pairs[0]!.difficulty).toBe('medium')
  })

  it('reports bad rows without discarding good ones', () => {
    const { pairs, issues } = parseCustomPairs(
      ['Salt,Pepper', 'Solo', 'Tea,tea', 'Ice,Snow,cold,extreme', 'salt,PEPPER'].join('\n'),
    )
    expect(pairs).toHaveLength(1)
    expect(issues).toEqual([
      { line: 2, code: 'BAD_COLUMNS' },
      { line: 3, code: 'IDENTICAL_WORDS' },
      { line: 4, code: 'BAD_DIFFICULTY' },
      { line: 5, code: 'DUPLICATE' },
    ])
  })

  it('marks custom pairs so they cannot be mistaken for catalog content', () => {
    const { pairs } = parseCustomPairs('Salt,Pepper')
    expect(pairs[0]!.contentVersion.startsWith('custom:')).toBe(true)
  })
})
