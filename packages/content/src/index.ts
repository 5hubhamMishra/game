import type { Rng } from '@bw/game-core'
import { normalizeWord } from '@bw/game-core'
import {
  CONTENT_VERSION,
  DEFAULT_LOCALE,
  pairKey,
  toPair,
  type CatalogPair,
  type PairSeed,
} from './schema.ts'
import { ANIMALS, CLOTHING, DRINKS, FOOD, HOUSEHOLD } from './pairs-everyday.ts'
import { MUSIC, PLACES, SPORTS, TECHNOLOGY, TRANSPORT } from './pairs-world.ts'

export * from './schema.ts'

const SEEDS: Record<string, PairSeed[]> = {
  food: FOOD,
  drinks: DRINKS,
  clothing: CLOTHING,
  household: HOUSEHOLD,
  animals: ANIMALS,
  transport: TRANSPORT,
  places: PLACES,
  sports: SPORTS,
  technology: TECHNOLOGY,
  music: MUSIC,
}

export const CATEGORIES = Object.keys(SEEDS)

export const CATALOG: readonly CatalogPair[] = Object.entries(SEEDS).flatMap(([category, seeds]) =>
  seeds.map((seed) => toPair(category, seed)),
)

const BY_ID = new Map(CATALOG.map((pair) => [pair.id, pair]))

export function findPair(id: string): CatalogPair | undefined {
  return BY_ID.get(id)
}

export interface PairFilter {
  readonly difficulties?: readonly CatalogPair['difficulty'][]
  readonly categories?: readonly string[]
  /** Ids already used this game, so a room does not repeat a pair. */
  readonly excludeIds?: readonly string[]
}

export function filterPairs(filter: PairFilter = {}): CatalogPair[] {
  const { difficulties, categories, excludeIds } = filter
  return CATALOG.filter(
    (pair) =>
      (!difficulties || difficulties.includes(pair.difficulty)) &&
      (!categories || categories.includes(pair.category)) &&
      (!excludeIds || !excludeIds.includes(pair.id)),
  )
}

/** Picks one pair uniformly from the filtered set. Returns undefined if empty,
 *  which the caller must handle — usually by clearing `excludeIds`. */
export function pickPair(rng: Rng, filter: PairFilter = {}): CatalogPair | undefined {
  const pool = filterPairs(filter)
  if (pool.length === 0) return undefined
  return pool[rng.nextInt(pool.length)]
}

// -------------------------------------------------------------- custom pairs

export type CustomPairError =
  | 'BAD_COLUMNS'
  | 'EMPTY_WORD'
  | 'IDENTICAL_WORDS'
  | 'BAD_DIFFICULTY'
  | 'DUPLICATE'

export interface CustomPairIssue {
  readonly line: number
  readonly code: CustomPairError
}

export interface CustomPairResult {
  readonly pairs: CatalogPair[]
  readonly issues: CustomPairIssue[]
}

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

function parseCsvRow(text: string): string[] | undefined {
  const cells: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }

  if (quoted) return undefined
  cells.push(cell.trim())
  return cells
}

/** Parses CSV rows and rejects bad rows individually. */
export function parseCustomPairs(csv: string, locale = DEFAULT_LOCALE): CustomPairResult {
  const pairs: CatalogPair[] = []
  const issues: CustomPairIssue[] = []
  const seen = new Set<string>()

  csv.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const text = raw.trim()
    if (text === '' || text.startsWith('#')) return

    const cells = parseCsvRow(text)
    if (!cells) return void issues.push({ line, code: 'BAD_COLUMNS' })
    if (index === 0 && normalizeWord(cells[0] ?? '') === 'worda') return
    if (cells.length < 2 || cells.length > 4) return void issues.push({ line, code: 'BAD_COLUMNS' })

    const [wordA = '', wordB = '', category = 'custom', difficulty = 'medium'] = cells
    if (wordA === '' || wordB === '') return void issues.push({ line, code: 'EMPTY_WORD' })
    if (normalizeWord(wordA) === normalizeWord(wordB)) {
      return void issues.push({ line, code: 'IDENTICAL_WORDS' })
    }
    if (!DIFFICULTIES.includes(difficulty as (typeof DIFFICULTIES)[number])) {
      return void issues.push({ line, code: 'BAD_DIFFICULTY' })
    }

    const key = pairKey(wordA, wordB, locale)
    if (seen.has(key)) return void issues.push({ line, code: 'DUPLICATE' })
    seen.add(key)

    const seed: PairSeed = [wordA, wordB, difficulty as (typeof DIFFICULTIES)[number], 'Custom pair supplied by the host.']
    pairs.push({ ...toPair(category === '' ? 'custom' : category, seed, locale), contentVersion: `custom:${CONTENT_VERSION}` })
  })

  return { pairs, issues }
}
