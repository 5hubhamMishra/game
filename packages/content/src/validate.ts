import { normalizeWord } from '@bw/game-core'
import { CATALOG, CATEGORIES } from './index.ts'
import { CONTENT_GATE, EXPANSION_TARGET_PAIRS, pairKey, wordPairSchema } from './schema.ts'

/**
 * Content gate for CI. Fails the build rather than warning, because a duplicate
 * or a self-referential pair is a broken round for real players, not a lint nit.
 */
function validate(): string[] {
  const errors: string[] = []
  const keys = new Map<string, string>()
  const ids = new Map<string, string>()
  const perCategory = new Map<string, number>()

  for (const pair of CATALOG) {
    const label = `${pair.category}: ${pair.wordA} / ${pair.wordB}`

    const parsed = wordPairSchema.safeParse(pair)
    if (!parsed.success) {
      errors.push(`${label} — schema: ${parsed.error.issues.map((i) => i.message).join('; ')}`)
      continue
    }

    if (normalizeWord(pair.wordA) === normalizeWord(pair.wordB)) {
      errors.push(`${label} — both words normalize identically`)
    }

    const key = pairKey(pair.wordA, pair.wordB)
    const clash = keys.get(key)
    if (clash) errors.push(`${label} — duplicate of ${clash} (order does not matter)`)
    else keys.set(key, label)

    const idClash = ids.get(pair.id)
    if (idClash) errors.push(`${label} — id ${pair.id} collides with ${idClash}`)
    else ids.set(pair.id, label)

    perCategory.set(pair.category, (perCategory.get(pair.category) ?? 0) + 1)
  }

  if (CATALOG.length < CONTENT_GATE.minPairs) {
    errors.push(`only ${CATALOG.length} pairs; ${CONTENT_GATE.minPairs} required`)
  }
  if (CATEGORIES.length < CONTENT_GATE.minCategories) {
    errors.push(`only ${CATEGORIES.length} categories; ${CONTENT_GATE.minCategories} required`)
  }
  for (const category of CATEGORIES) {
    const count = perCategory.get(category) ?? 0
    if (count < CONTENT_GATE.minPairsPerCategory) {
      errors.push(`category ${category} has ${count} pairs; ${CONTENT_GATE.minPairsPerCategory} required`)
    }
  }

  return errors
}

export { validate }

if (process.argv[1]?.includes('validate')) {
  const errors = validate()
  for (const error of errors) console.error(`✗ ${error}`)
  if (errors.length > 0) {
    console.error(`\n${errors.length} content error(s).`)
    process.exit(1)
  }
  console.log(
    `✓ ${CATALOG.length} pairs across ${CATEGORIES.length} categories ` +
      `(expansion milestone: ${EXPANSION_TARGET_PAIRS}).`,
  )
}
