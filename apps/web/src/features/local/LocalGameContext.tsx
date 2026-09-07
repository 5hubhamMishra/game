"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  EngineError,
  LOCAL_SETTINGS,
  type ErrorCode,
  type GameState,
  type PlayerId,
  type Settings,
  type WordPair,
  acceptEarlyVote,
  acknowledgeWord,
  advanceFromResolution,
  endDiscussion,
  maxMinorityCount,
  requestEarlyVote,
  secureRng,
  settleOverdue,
  startGame,
  submitClue,
  submitVote,
  winningPlayers,
} from "@bw/game-core";
import {
  type LocalPrefs,
  type RosterEntry,
  loadPrefs,
  loadRoster,
  loadScores,
  newPlayerId,
  resetScores as resetStoredScores,
  savePrefs,
  saveRoster,
  saveScores,
} from "./storage";
import { pickNextPair } from "./pairs";

type Ctx = {
  roster: RosterEntry[];
  setRoster: (r: RosterEntry[]) => void;
  prefs: LocalPrefs;
  setPrefs: (p: LocalPrefs) => void;
  scores: Record<PlayerId, number>;
  resetScores: () => void;
  game: GameState | null;
  error: string | null;
  clearError: () => void;
  nameOf: (id: PlayerId) => string;
  start: (nextRoster: RosterEntry[], nextPrefs: LocalPrefs) => void;
  acknowledge: (id: PlayerId) => void;
  giveClueAloud: (id: PlayerId) => void;
  endDiscussionNow: () => void;
  requestEarlyVoteFrom: (id: PlayerId) => void;
  acceptEarlyVoteFrom: (id: PlayerId) => void;
  vote: (voterId: PlayerId, targetId: PlayerId | null) => void;
  continueFromResolution: () => void;
  rematch: () => void;
  backToLobby: () => void;
};

const LocalGameCtx = createContext<Ctx | null>(null);

const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  INVALID_CLUE: "That clue was not accepted.",
  NOT_YOUR_TURN: "It is not that player's turn.",
  ALREADY_SUBMITTED: "That action was already recorded.",
  SELF_VOTE: "A player cannot vote for themself.",
  INVALID_VOTE_TARGET: "That player cannot be voted for right now.",
};

function newPair(prefs: LocalPrefs, lastCustomId?: string) {
  const result = pickNextPair(prefs, lastCustomId);
  if (!result.ok) {
    const message =
      result.reason === "NOT_ENOUGH_CUSTOM_PAIRS"
        ? "Custom-only play needs at least 5 valid unique pairs. Add more in setup."
        : "No word pairs match the chosen categories and difficulties. Widen your selection in setup.";
    throw new Error(message);
  }
  return result;
}

export function LocalGameProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializers run once per environment (server render vs. client
  // hydration), so this reads real localStorage on the client without an
  // effect — storage.ts's read() falls back to [] during server rendering.
  const [roster, setRosterState] = useState<RosterEntry[]>(loadRoster);
  const [prefs, setPrefsState] = useState<LocalPrefs>(loadPrefs);
  const [scores, setScores] = useState<Record<PlayerId, number>>(loadScores);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPairRef = useRef<WordPair | null>(null);
  const scoredSessionRef = useRef<symbol | null>(null);
  const sessionRef = useRef<symbol | null>(null);

  const setRoster = useCallback((r: RosterEntry[]) => {
    setRosterState(r);
    saveRoster(r);
  }, []);
  const setPrefs = useCallback((p: LocalPrefs) => {
    setPrefsState(p);
    savePrefs(p);
  }, []);

  const nameOf = useCallback(
    (id: PlayerId) => roster.find((r) => r.id === id)?.name ?? "Unknown player",
    [roster],
  );

  const run = useCallback((fn: () => GameState) => {
    try {
      setGame(fn());
      setError(null);
    } catch (err) {
      if (err instanceof EngineError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
  }, []);

  const beginGame = useCallback(
    (forRoster: RosterEntry[], forPrefs: LocalPrefs, excludeCustomId?: string) => {
      const picked = newPair(forPrefs, excludeCustomId);
      lastPairRef.current = picked.pair;
      sessionRef.current = Symbol("game-session");
      const settings: Settings = {
        ...(forPrefs.timersOn ? DEFAULT_SETTINGS : LOCAL_SETTINGS),
        minorityCount: Math.min(forPrefs.minorityCount, maxMinorityCount(forRoster.length)),
        categories: forPrefs.categories,
        difficulties: forPrefs.difficulties,
      };
      run(() =>
        startGame(forRoster.map((r) => r.id), settings, picked.pair, { now: Date.now(), rng: secureRng() }),
      );
    },
    [run],
  );

  const start = useCallback(
    (nextRoster: RosterEntry[], nextPrefs: LocalPrefs) => {
      setRoster(nextRoster);
      setPrefs(nextPrefs);
      beginGame(nextRoster, nextPrefs);
    },
    [beginGame, setRoster, setPrefs],
  );

  const acknowledge = useCallback(
    (id: PlayerId) => game && run(() => acknowledgeWord(game, id, { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const giveClueAloud = useCallback(
    (id: PlayerId) =>
      game && run(() => submitClue(game, id, "Clue given aloud", { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const endDiscussionNow = useCallback(
    () => game && run(() => endDiscussion(game, { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const requestEarlyVoteFrom = useCallback(
    (id: PlayerId) => game && run(() => requestEarlyVote(game, id)),
    [game, run],
  );

  const acceptEarlyVoteFrom = useCallback(
    (id: PlayerId) => game && run(() => acceptEarlyVote(game, id, { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const vote = useCallback(
    (voterId: PlayerId, targetId: PlayerId | null) =>
      game && run(() => submitVote(game, voterId, targetId, { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const continueFromResolution = useCallback(
    () => game && run(() => advanceFromResolution(game, { now: Date.now(), rng: secureRng() })),
    [game, run],
  );

  const rematch = useCallback(() => {
    const excludeCustomId = lastPairRef.current?.contentVersion.startsWith("custom:")
      ? lastPairRef.current.id
      : undefined;
    beginGame(roster, prefs, excludeCustomId);
  }, [beginGame, roster, prefs]);

  const backToLobby = useCallback(() => {
    setGame(null);
    setError(null);
  }, []);

  const resetScores = useCallback(() => {
    resetStoredScores();
    setScores({});
  }, []);

  // Awards points exactly once per completed game, keyed by the session symbol
  // created in start()/rematch() rather than any field inside GameState.
  useEffect(() => {
    if (!game || game.phase !== "RESULTS" || !game.winner) return;
    if (scoredSessionRef.current === sessionRef.current) return;
    scoredSessionRef.current = sessionRef.current;
    setScores((prev) => {
      const next = { ...prev };
      for (const id of winningPlayers(game)) next[id] = (next[id] ?? 0) + 1;
      saveScores(next);
      return next;
    });
  }, [game]);

  // Settles overdue timed phases (clue/discussion/voting) once per second when
  // timers are on. Server deadlines have no local equivalent, so the same
  // deterministic settleOverdue the engine exposes for server restarts runs
  // here on a plain interval.
  useEffect(() => {
    if (!game || !prefs.timersOn || game.deadline === null) return;
    const id = setInterval(() => {
      setGame((current) => {
        if (!current || current.deadline === null) return current;
        if (current.deadline > Date.now()) return current;
        return settleOverdue(current, { now: Date.now(), rng: secureRng() });
      });
    }, 500);
    return () => clearInterval(id);
  }, [game, prefs.timersOn]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<Ctx>(
    () => ({
      roster,
      setRoster,
      prefs,
      setPrefs,
      scores,
      resetScores,
      game,
      error,
      clearError,
      nameOf,
      start,
      acknowledge,
      giveClueAloud,
      endDiscussionNow,
      requestEarlyVoteFrom,
      acceptEarlyVoteFrom,
      vote,
      continueFromResolution,
      rematch,
      backToLobby,
    }),
    [
      roster,
      setRoster,
      prefs,
      setPrefs,
      scores,
      resetScores,
      game,
      error,
      clearError,
      nameOf,
      start,
      acknowledge,
      giveClueAloud,
      endDiscussionNow,
      requestEarlyVoteFrom,
      acceptEarlyVoteFrom,
      vote,
      continueFromResolution,
      rematch,
      backToLobby,
    ],
  );

  return <LocalGameCtx.Provider value={value}>{children}</LocalGameCtx.Provider>;
}

export function useLocalGame(): Ctx {
  const ctx = useContext(LocalGameCtx);
  if (!ctx) throw new Error("useLocalGame must be used within LocalGameProvider");
  return ctx;
}

export { newPlayerId };
