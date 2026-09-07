import type { Difficulty } from "@bw/game-core";

export type RosterEntry = { id: string; name: string };

export type LocalPrefs = {
  minorityCount: number;
  timersOn: boolean;
  categories: string[] | null;
  difficulties: Difficulty[];
  customCsv: string;
  useCustomOnly: boolean;
};

const DEFAULT_PREFS: LocalPrefs = {
  minorityCount: 1,
  timersOn: false,
  categories: null,
  difficulties: ["easy", "medium"],
  customCsv: "",
  useCustomOnly: false,
};

const KEYS = {
  roster: "bw:local:roster",
  prefs: "bw:local:prefs",
  scores: "bw:local:scores",
  recentPairs: "bw:local:recentPairs",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota) — preferences just won't persist.
  }
}

export const loadRoster = (): RosterEntry[] => read(KEYS.roster, []);
export const saveRoster = (roster: RosterEntry[]): void => write(KEYS.roster, roster);

export const loadPrefs = (): LocalPrefs => ({ ...DEFAULT_PREFS, ...read(KEYS.prefs, {}) });
export const savePrefs = (prefs: LocalPrefs): void => write(KEYS.prefs, prefs);

export const loadScores = (): Record<string, number> => read(KEYS.scores, {});
export const saveScores = (scores: Record<string, number>): void => write(KEYS.scores, scores);
export const resetScores = (): void => write(KEYS.scores, {});

export const loadRecentPairIds = (): string[] => read(KEYS.recentPairs, []);
export function pushRecentPairId(id: string): void {
  const next = [id, ...loadRecentPairIds().filter((x) => x !== id)].slice(0, 20);
  write(KEYS.recentPairs, next);
}

export function newPlayerId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
