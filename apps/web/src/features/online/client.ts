import { io, type Socket } from "socket.io-client";
import { publicRoomViewSchema, resultsViewSchema, selfViewSchema, type PublicRoomView, type ResultsView, type SelfView } from "@bw/contracts";
import { loadPlayerId, savePlayerId } from "./storage";

export const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as Partial<T> & { code?: string };
  if (!response.ok) throw new ApiError(data.code ?? "SERVER_ERROR", response.status);
  return data as T;
}

/** Idempotent: reuses the cached guest identity instead of minting a new one every visit. */
export async function ensureSession(): Promise<string> {
  const cached = loadPlayerId();
  if (cached) return cached;
  const { playerId } = await api<{ playerId: string }>("/sessions", { method: "POST" });
  savePlayerId(playerId);
  return playerId;
}

export async function createRoom(name: string): Promise<string> {
  const { code } = await api<{ code: string }>("/rooms", { method: "POST", body: JSON.stringify({ name }) });
  return code;
}

export async function joinRoomHttp(code: string, name: string): Promise<void> {
  await api<{ code: string }>(`/rooms/${code}/members`, { method: "POST", body: JSON.stringify({ name }) });
}

function eventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type Ack = { ok: boolean; code?: string; room?: unknown; self?: unknown; results?: unknown };

function emitWithAck(socket: Socket, event: string, payload: unknown, timeoutMs = 8000): Promise<Ack> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    socket.emit(event, payload, (result: Ack) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

export type RoomHandle = {
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  revealWord: () => Promise<SelfView | null>;
  acknowledgeWord: () => Promise<void>;
  submitClue: (text: string) => Promise<void>;
  postDiscussion: (text: string) => Promise<void>;
  requestEarlyVote: () => Promise<void>;
  acceptEarlyVote: () => Promise<void>;
  submitVote: (targetId: string | null) => Promise<void>;
  continueFromResolution: () => Promise<void>;
  requestRematch: () => Promise<void>;
  disconnect: () => void;
};

/**
 * Connects, joins the given room over the socket, and keeps `onSnapshot` fed
 * with every broadcast.
 *
 * `onError` is only for a join that never succeeds (bad room, no membership) —
 * it's treated as fatal by the caller. A drop after that is transient:
 * socket.io reconnects and re-emits `connect` on its own, which re-runs
 * `joinRoom` and refreshes the snapshot — so a mid-lobby disconnect surfaces
 * through `onConnectionChange`, not `onError`, and clears itself once the
 * rejoin lands. An in-game action being rejected (wrong turn, self-vote,
 * already voted, a stale revision, ...) is expected and recoverable, so it
 * goes to `onActionError` instead — falling back to `onError` only if the
 * caller didn't provide one — rather than tearing down the whole room view.
 */
export function connectToRoom(
  code: string,
  handlers: {
    onSnapshot: (view: PublicRoomView) => void;
    onResults?: (view: ResultsView) => void;
    onSelf?: (view: SelfView) => void;
    onError: (code: string) => void;
    onActionError?: (code: string) => void;
    onConnectionChange?: (connected: boolean) => void;
  },
): RoomHandle {
  const socket = io(SERVER_URL, { withCredentials: true, transports: ["websocket", "polling"] });
  let joinedOnce = false;
  const reportActionError = (code: string) => (handlers.onActionError ?? handlers.onError)(code);

  function accept(raw: unknown) {
    const parsed = publicRoomViewSchema.safeParse(raw);
    if (parsed.success) handlers.onSnapshot(parsed.data);
  }
  function acceptSelf(raw: unknown) {
    const parsed = selfViewSchema.safeParse(raw);
    if (parsed.success) handlers.onSelf?.(parsed.data);
    return parsed.success ? parsed.data : null;
  }
  function acceptResults(raw: unknown) {
    const parsed = resultsViewSchema.safeParse(raw);
    if (parsed.success) handlers.onResults?.(parsed.data);
    return parsed.success ? parsed.data : null;
  }

  socket.on("connect", async () => {
    try {
      const result = await emitWithAck(socket, "joinRoom", { eventId: eventId(), roomCode: code });
      if (!result.ok || !result.room) return handlers.onError(result.code ?? "JOIN_FAILED");
      joinedOnce = true;
      accept(result.room);
      if (result.self) acceptSelf(result.self);
      if (result.results) acceptResults(result.results);
      void emitWithAck(socket, "getResults", { eventId: eventId() }).then((latest) => { if (latest.results) acceptResults(latest.results); });
      handlers.onConnectionChange?.(true);
    } catch {
      handlers.onError("JOIN_FAILED");
    }
  });

  socket.on("roomSnapshot", accept);
  socket.on("roomResults", acceptResults);
  socket.on("connect_error", () => {
    if (!joinedOnce) handlers.onError("CONNECTION_FAILED");
  });
  socket.on("disconnect", () => handlers.onConnectionChange?.(false));

  return {
    async setReady(ready: boolean) {
      const result = await emitWithAck(socket, "setReady", { eventId: eventId(), ready });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "SET_READY_FAILED");
      accept(result.room);
    },
    async startGame() {
      const result = await emitWithAck(socket, "startGame", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "START_FAILED");
      accept(result.room);
    },
    async revealWord() {
      const result = await emitWithAck(socket, "revealWord", { eventId: eventId() });
      if (!result.ok || !result.self) {
        if (!result.ok) reportActionError(result.code ?? "REVEAL_FAILED");
        return null;
      }
      return acceptSelf(result.self);
    },
    async acknowledgeWord() {
      const result = await emitWithAck(socket, "acknowledgeWord", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "ACKNOWLEDGE_FAILED");
      accept(result.room);
    },
    async submitClue(text: string) {
      const result = await emitWithAck(socket, "submitClue", { eventId: eventId(), text });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "CLUE_FAILED");
      accept(result.room);
    },
    async postDiscussion(text: string) {
      const result = await emitWithAck(socket, "postDiscussion", { eventId: eventId(), text });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "MESSAGE_FAILED");
      accept(result.room);
    },
    async requestEarlyVote() {
      const result = await emitWithAck(socket, "requestEarlyVote", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "EARLY_VOTE_FAILED");
      accept(result.room);
    },
    async acceptEarlyVote() {
      const result = await emitWithAck(socket, "acceptEarlyVote", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "EARLY_VOTE_FAILED");
      accept(result.room);
    },
    async submitVote(targetId: string | null) {
      const result = await emitWithAck(socket, "submitVote", { eventId: eventId(), targetId });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "VOTE_FAILED");
      accept(result.room);
    },
    async continueFromResolution() {
      const result = await emitWithAck(socket, "continueFromResolution", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "CONTINUE_FAILED");
      accept(result.room);
      if (result.results) acceptResults(result.results);
    },
    async requestRematch() {
      const result = await emitWithAck(socket, "requestRematch", { eventId: eventId() });
      if (!result.ok || !result.room) return reportActionError(result.code ?? "REMATCH_FAILED");
      accept(result.room);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
