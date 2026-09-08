"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicRoomView, ResultsView, SelfView } from "@bw/contracts";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ApiError, connectToRoom, ensureSession, joinRoomHttp, type RoomHandle } from "./client";
import { loadDisplayName, saveDisplayName } from "./storage";

type Status = "checking-name" | "joining" | "in-lobby" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: "That room doesn't exist or has expired.",
  NAME_TAKEN: "Someone in this room already has that name.",
  ROOM_FULL: "That room is full.",
  SESSION_REQUIRED: "Could not start a guest session.",
  NOT_A_MEMBER: "Join this room first before connecting.",
  CONNECTION_FAILED: "Could not reach the game server.",
  JOIN_FAILED: "Could not join this room.",
};

/**
 * In-game action rejections are expected and recoverable (wrong turn, a stale
 * revision, an invalid vote target, ...) — shown inline via `onActionError`,
 * never routed to the fatal `ErrorView` the way a failed join is.
 */
const ACTION_ERROR_MESSAGES: Record<string, string> = {
  NOT_YOUR_TURN: "It's not your turn yet.",
  WRONG_PHASE: "That's not available right now — the room moved on.",
  SELF_VOTE: "You can't vote for yourself.",
  ALREADY_VOTED: "You've already voted this round.",
  INVALID_VOTE_TARGET: "That player can't be voted for right now.",
  STALE_REVISION: "The room changed — try again.",
  NOT_HOST: "Only the host can do that.",
  ALREADY_STARTED: "The game already started.",
  NOT_ALL_READY: "Need at least 3 players, with everyone but the host ready.",
  NO_PAIR_AVAILABLE: "No word pair was available to start with.",
  TOO_LONG: "That clue is too long.",
  TOO_MANY_WORDS: "Clues are one to three words.",
  EMPTY: "Enter a clue first.",
  NO_LETTERS: "That clue needs some letters.",
  CONTAINS_OWN_WORD: "A clue can't contain your own word.",
  RATE_LIMITED: "Slow down a little before sending another message.",
  EARLY_VOTE_FAILED: "Could not update the early-vote request.",
  CANCEL_FAILED: "Could not cancel the game.",
  ORIGIN_NOT_ALLOWED: "This site is not allowed to use the game server.",
};

export function RoomLobby({ code }: { code: string }) {
  const [name, setName] = useState(() => loadDisplayName());
  const [status, setStatus] = useState<Status>(() => (loadDisplayName() ? "joining" : "checking-name"));
  const [room, setRoom] = useState<PublicRoomView | null>(null);
  const [selfView, setSelfView] = useState<SelfView | null>(null);
  const [results, setResults] = useState<ResultsView | null>(null);
  const [justEliminated, setJustEliminated] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [handle, setHandle] = useState<RoomHandle | null>(null);
  const socketRef = useRef<RoomHandle | null>(null);
  // Tracks eliminated-player ids across snapshots so RESOLUTION can name who
  // was *just* eliminated — the public view only ever exposes the cumulative
  // eliminated set, not a per-cycle delta.
  const eliminatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "joining") return;
    let cancelled = false;

    (async () => {
      try {
        const id = await ensureSession();
        if (cancelled) return;
        setPlayerId(id);
        await joinRoomHttp(code, name);
        if (cancelled) return;
        const nextHandle = connectToRoom(code, {
          onSnapshot: (view) => {
            if (cancelled) return;
            if (view.phase === "LOBBY") {
              // A fresh game (first join, or after a rematch) — clear anything
              // carried over so a stale word/result from a previous game can
              // never be shown before the player reveals again.
              setSelfView(null);
              setResults(null);
              setJustEliminated(null);
              eliminatedRef.current = new Set();
            } else {
              const nowEliminated = new Set(view.players.filter((p) => p.eliminated).map((p) => p.id));
              if (view.phase === "RESOLUTION") {
                const newlyEliminated = [...nowEliminated].find((id) => !eliminatedRef.current.has(id));
                setJustEliminated(newlyEliminated ?? null);
              }
              eliminatedRef.current = nowEliminated;
            }
            setRoom(view);
            setStatus("in-lobby");
          },
          onSelf: setSelfView,
          onResults: setResults,
          onError: (errorCode) => {
            if (cancelled) return;
            setError(errorCode);
            setStatus("error");
          },
          onActionError: (errorCode) => {
            if (!cancelled) setActionMessage(ACTION_ERROR_MESSAGES[errorCode] ?? errorCode);
          },
          onConnectionChange: (isConnected) => {
            if (!cancelled) {
              setConnected(isConnected);
              if (!isConnected) setSelfView(null);
            }
          },
        });
        socketRef.current = nextHandle;
        setHandle(nextHandle);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.code : "JOIN_FAILED");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setHandle(null);
    };
  }, [status, code, name]);

  function submitName(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveDisplayName(trimmed);
    setName(trimmed);
    setStatus("joining");
  }

  if (status === "checking-name") return <NamePrompt code={code} onSubmit={submitName} />;
  if (status === "error") {
    return <ErrorView message={ERROR_MESSAGES[error ?? ""] ?? "Something went wrong."} onRetry={() => setStatus("joining")} />;
  }
  if (status === "joining" || !room || !playerId) {
    return (
      <div className="mx-auto max-w-md py-10 text-center text-muted">
        <p>Joining room {code}…</p>
      </div>
    );
  }

  if (room.phase !== "LOBBY") {
    return (
      <OnlineGame
        room={room}
        self={selfView}
        results={results}
        justEliminated={justEliminated}
        selfId={playerId}
        connected={connected}
        handle={handle}
        actionMessage={actionMessage}
        clearActionMessage={() => setActionMessage(null)}
      />
    );
  }

  return (
    <LobbyView
      code={code}
      room={room}
      selfId={playerId}
      connected={connected}
      actionMessage={actionMessage}
      onToggleReady={() => {
        setActionMessage(null);
        const self = room.players.find((p) => p.id === playerId);
        void socketRef.current?.setReady(!self?.ready);
      }}
      onStart={() => {
        setActionMessage(null);
        void socketRef.current?.startGame();
      }}
    />
  );
}

function NamePrompt({ code, onSubmit }: { code: string; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="font-display text-3xl font-bold">Join room {code}</h1>
      <Card className="mt-6">
        <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={40}
          className="mt-2 w-full rounded-xl border border-line bg-transparent px-4 py-2.5"
        />
        <Button className="mt-4 w-full" onClick={() => onSubmit(value)}>
          Join
        </Button>
      </Card>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <Card>
        <p className="font-semibold">{message}</p>
      </Card>
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function LobbyView({
  code,
  room,
  selfId,
  connected,
  actionMessage,
  onToggleReady,
  onStart,
}: {
  code: string;
  room: PublicRoomView;
  selfId: string;
  connected: boolean;
  actionMessage: string | null;
  onToggleReady: () => void;
  onStart: () => void;
}) {
  const self = room.players.find((p) => p.id === selfId);
  const isHost = room.hostId === selfId;
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is already shown on screen to copy by hand.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard unavailable — the room code remains available to copy by hand.
    }
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      {!connected && (
        <p className="mb-4 rounded-xl bg-amber/20 px-4 py-2 text-center text-sm font-semibold text-ink">
          Reconnecting…
        </p>
      )}

      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">Room code</p>
      <h1 className="text-center font-display text-4xl font-bold tracking-tight">{code}</h1>
      <div className="mt-2 flex justify-center">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copyCode}>{copied ? "Copied!" : "Copy code"}</Button>
          <Button variant="secondary" onClick={copyLink}>{copiedLink ? "Link copied!" : "Copy invite link"}</Button>
        </div>
      </div>

      <Card className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Players — {room.players.length}</p>
        <ul className="mt-3 space-y-2">
          {room.players.map((player) => (
            <li key={player.id} className="flex items-center justify-between text-sm">
              <span>
                {player.name}
                {player.id === room.hostId ? " (host)" : ""}
                {!player.connected ? " · offline" : ""}
              </span>
              <span className={player.ready ? "font-semibold text-teal" : "text-muted"}>
                {player.ready ? "Ready" : "Not ready"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {self && (
        <Button className="mt-6 w-full" variant={self.ready ? "secondary" : "primary"} onClick={onToggleReady}>
          {self.ready ? "Not ready" : "I'm ready"}
        </Button>
      )}

      <Card className="mt-6 text-left">
        <p className="text-sm text-muted">{isHost ? "Start when everyone is ready." : "Waiting on the host to start."}</p>
        {isHost && <Button className="mt-4 w-full" onClick={onStart} disabled={room.players.length < 3 || room.players.some((p) => p.id !== selfId && !p.ready)}>Start game</Button>}
      </Card>

      {actionMessage && <p role="alert" className="mt-4 text-center text-sm text-danger">{actionMessage}</p>}

      <p className="mt-6 text-center">
        <Link href="/online" className="text-sm text-muted underline">
          Leave room
        </Link>
      </p>
    </div>
  );
}

function OnlineGame({
  room,
  self,
  results,
  justEliminated,
  selfId,
  connected,
  handle,
  actionMessage,
  clearActionMessage,
}: {
  room: PublicRoomView;
  self: SelfView | null;
  results: ResultsView | null;
  justEliminated: string | null;
  selfId: string;
  connected: boolean;
  handle: RoomHandle | null;
  actionMessage: string | null;
  clearActionMessage: () => void;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!handle) return <p className="mx-auto max-w-md py-10 text-center text-muted">Reconnecting…</p>;
  const active = room.players.filter((player) => !player.eliminated && player.id !== selfId);
  async function send(action: () => Promise<void>) {
    setMessage(null);
    clearActionMessage();
    await action();
    setText("");
  }
  return (
    <div className="mx-auto max-w-lg py-10">
      <p className="sr-only" aria-live="polite">Phase: {room.phase.replaceAll("_", " ")}{connected ? "" : ". Reconnecting."}</p>
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">{room.phase}</p>
      <h1 className="mt-2 text-center font-display text-3xl font-bold">Room {room.roomCode}</h1>
      {room.hostId === selfId && !["RESULTS", "ABORTED"].includes(room.phase) && <Button className="mt-4 w-full" variant="secondary" onClick={() => { if (window.confirm("Cancel this game for everyone? No points will be awarded.")) void handle.cancelGame(); }}>Cancel game</Button>}
      {room.phase === "PRIVATE_REVEAL" && (
        <Card className="mt-6 text-center">
          {self?.self.word ? <><p className="text-sm text-muted">Your word</p><p className="mt-3 font-display text-4xl font-bold">{self.self.word}</p><Button className="mt-6 w-full" onClick={() => void send(() => handle.acknowledgeWord())}>Hide and continue</Button></> : <Button className="w-full" onClick={async () => setMessage((await handle.revealWord()) ? "Word revealed. Keep it private." : "Could not reveal the word.")}>Reveal my word</Button>}
        </Card>
      )}
      {room.phase === "CLUES" && <Card className="mt-6"><p className="text-sm text-muted">Submit your short clue when it is your turn.</p><label className="sr-only" htmlFor="online-clue">Your clue</label><input id="online-clue" value={text} onChange={(e) => setText(e.target.value)} maxLength={40} className="mt-3 w-full rounded-xl border border-line bg-transparent px-4 py-2.5" /><Button className="mt-3 w-full" onClick={() => void send(() => handle.submitClue(text))}>Submit clue</Button></Card>}
      {room.phase === "DISCUSSION" && <Card className="mt-6"><div className="space-y-2 text-sm">{room.discussion.map((item) => <p key={item.id}><strong>{room.players.find((p) => p.id === item.playerId)?.name ?? "Player"}:</strong> {item.text}</p>)}</div><label className="sr-only" htmlFor="discussion-message">Discussion message</label><input id="discussion-message" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} className="mt-4 w-full rounded-xl border border-line bg-transparent px-4 py-2.5" /><Button className="mt-3 w-full" onClick={() => void send(() => handle.postDiscussion(text))}>Send message</Button><div className="mt-4 border-t border-line pt-4">{room.earlyVoteRequest ? <><p className="text-sm text-muted">A player requested an early vote. Active players must agree.</p><Button className="mt-3 w-full" variant="secondary" onClick={() => void send(() => handle.acceptEarlyVote())}>Accept early vote</Button></> : <Button className="mt-3 w-full" variant="secondary" onClick={() => void send(() => handle.requestEarlyVote())}>Request early vote</Button>}</div></Card>}
      {room.phase === "VOTING" && <Card className="mt-6"><label className="sr-only" htmlFor="vote-target">Player to vote for</label><select id="vote-target" value={target ?? ""} onChange={(e) => setTarget(e.target.value || null)} className="w-full rounded-xl border border-line bg-transparent px-4 py-2.5"><option value="">Abstain</option>{active.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><Button className="mt-3 w-full" onClick={() => void handle.submitVote(target)}>Submit vote</Button></Card>}
      {room.phase === "RESOLUTION" && (
        <Card className="mt-6 text-center">
          <p>{justEliminated ? `${room.players.find((p) => p.id === justEliminated)?.name ?? "A player"} was eliminated.` : "Nobody was eliminated."}</p>
          <Button className="mt-4 w-full" onClick={() => void send(() => handle.continueFromResolution())}>Continue</Button>
        </Card>
      )}
      {room.phase === "RESULTS" && <Card className="mt-6"><p className="text-center font-semibold">{results ? `${results.winner === "majority" ? "Majority" : "Minority"} wins.` : "Game complete."}</p>{results && <><p className="mt-3 text-sm text-muted">The words were <strong>{results.wordA}</strong> and <strong>{results.wordB}</strong>.</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Room scores</p><ul className="mt-2 space-y-1 text-sm">{room.players.map((player) => <li key={player.id} className="flex justify-between"><span>{player.name}</span><strong>{results.scores[player.id] ?? 0}</strong></li>)}</ul><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">This game</p><ul className="mt-2 space-y-1 text-sm">{results.assignments.map((assignment) => <li key={assignment.playerId}>{room.players.find((player) => player.id === assignment.playerId)?.name ?? assignment.playerId}: {assignment.group}</li>)}</ul></>}<p className="mt-4 text-sm text-muted">Everyone must opt in before the next round starts.</p><Button className="mt-3 w-full" onClick={() => void handle.requestRematch()}>Ready for rematch</Button></Card>}
      {room.phase === "ABORTED" && <Card className="mt-6 text-center"><p>Game aborted.</p><Button className="mt-4 w-full" onClick={() => void handle.requestRematch()}>Back to lobby</Button></Card>}
      {(message || actionMessage) && <p role="status" aria-live="polite" className="mt-4 text-center text-sm text-muted">{message ?? actionMessage}</p>}
    </div>
  );
}
