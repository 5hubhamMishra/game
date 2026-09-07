import { filterPairs, parseCustomPairs, pickPair, type CatalogPair, type CustomPairResult } from "@bw/content";
import { secureRng } from "@bw/game-core";
import type { LocalPrefs } from "./storage";
import { loadRecentPairIds, pushRecentPairId } from "./storage";

export const MIN_CUSTOM_PAIRS = 5;

export function parseCustom(csv: string): CustomPairResult {
  return parseCustomPairs(csv);
}

export type PairPickResult =
  | { ok: true; pair: CatalogPair; cycled: boolean }
  | { ok: false; reason: "NO_MATCHING_PAIRS" | "NOT_ENOUGH_CUSTOM_PAIRS" };

/**
 * Picks the next pair for a new local game. Catalog picks avoid the last 20
 * used ids where the filtered pool allows; a small custom pool is allowed to
 * cycle, which the caller discloses in the UI.
 */
export function pickNextPair(prefs: LocalPrefs, excludeCustomId?: string): PairPickResult {
  const rng = secureRng();

  if (prefs.useCustomOnly) {
    const { pairs } = parseCustom(prefs.customCsv);
    if (pairs.length < MIN_CUSTOM_PAIRS) return { ok: false, reason: "NOT_ENOUGH_CUSTOM_PAIRS" };
    const pool = pairs.length > 1 ? pairs.filter((p) => p.id !== excludeCustomId) : pairs;
    const pair = pool[rng.nextInt(pool.length)]!;
    return { ok: true, pair, cycled: pairs.length < 2 };
  }

  const recent = loadRecentPairIds();
  const wide = filterPairs({ categories: prefs.categories ?? undefined, difficulties: prefs.difficulties });
  if (wide.length === 0) return { ok: false, reason: "NO_MATCHING_PAIRS" };

  const narrowed = pickPair(rng, {
    categories: prefs.categories ?? undefined,
    difficulties: prefs.difficulties,
    excludeIds: recent,
  });
  const pair = narrowed ?? wide[rng.nextInt(wide.length)]!;
  pushRecentPairId(pair.id);
  return { ok: true, pair, cycled: narrowed === undefined };
}
