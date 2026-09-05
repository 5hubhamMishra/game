/**
 * Randomness is an explicit engine input, never reached for inside a reducer.
 * `nextInt` is the only primitive the engine needs; implementations owe it an
 * unbiased draw in [0, maxExclusive).
 */
export type Rng = { nextInt(maxExclusive: number): number }

/**
 * Crypto-backed, rejection-sampled so the modulo tail cannot skew who is the
 * minority. Uses the WebCrypto global present in Node 22 and every target browser.
 */
export function secureRng(): Rng {
  return {
    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new RangeError(`nextInt needs a positive integer bound, got ${maxExclusive}`)
      }
      if (maxExclusive === 1) return 0
      // Largest multiple of the bound that fits in a uint32; draws above it are
      // rejected so every outcome keeps identical probability.
      const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
      const buf = new Uint32Array(1)
      for (;;) {
        crypto.getRandomValues(buf)
        const v = buf[0]!
        if (v < limit) return v % maxExclusive
      }
    },
  }
}

/** Deterministic counterpart for tests and reproducible fixtures. Not for real games. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9
  const next = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s
  }
  return {
    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new RangeError(`nextInt needs a positive integer bound, got ${maxExclusive}`)
      }
      if (maxExclusive === 1) return 0
      const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
      for (;;) {
        const v = next()
        if (v < limit) return v % maxExclusive
      }
    },
  }
}

/** Unbiased Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Unbiased k-of-n sample, order not significant. */
export function sample<T>(items: readonly T[], k: number, rng: Rng): T[] {
  if (k < 0 || k > items.length) throw new RangeError(`cannot sample ${k} of ${items.length}`)
  return shuffle(items, rng).slice(0, k)
}
