const KEYS = { playerId: "bw:online:playerId", name: "bw:online:name" } as const;

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota) — just won't persist.
  }
}

export const loadPlayerId = (): string | null => read(KEYS.playerId);
export const savePlayerId = (id: string): void => write(KEYS.playerId, id);
export const loadDisplayName = (): string => read(KEYS.name) ?? "";
export const saveDisplayName = (name: string): void => write(KEYS.name, name);
