"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ApiError, createRoom, ensureSession } from "./client";
import { loadDisplayName, saveDisplayName } from "./storage";

const ROOM_CODE_RE = /^[A-Z2-9]{6}$/;
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_NAME: "Enter a name between 1 and 40 characters.",
  SESSION_REQUIRED: "Could not start a guest session.",
  SESSION_EXPIRED: "Your guest session expired. Try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  ORIGIN_NOT_ALLOWED: "This site is not allowed to use the game server.",
  SERVER_ERROR: "The game server is unavailable right now.",
};

export function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState(() => loadDisplayName());
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter your name first.");
    setBusy(true);
    setError(null);
    try {
      saveDisplayName(trimmed);
      await ensureSession();
      const code = await createRoom(trimmed);
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? ERROR_MESSAGES[err.code] ?? "Could not create a room." : "Could not create a room.");
      setBusy(false);
    }
  }

  function handleJoin() {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed) return setError("Enter your name first.");
    if (!ROOM_CODE_RE.test(code)) return setError("Room codes are 6 letters or numbers.");
    saveDisplayName(trimmed);
    router.push(`/room/${code}`);
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="text-center font-display text-4xl font-bold tracking-tight">Play Online</h1>

      <Card className="mt-6">
        <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          className="mt-2 w-full rounded-xl border border-line bg-transparent px-4 py-2.5"
        />
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Host a new room</p>
        <Button className="mt-3 w-full" disabled={busy} onClick={handleCreate}>
          Create room
        </Button>
      </Card>

      <Card className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Join with a code</p>
        <label className="sr-only" htmlFor="join-code">Room code</label>
        <input
          id="join-code"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABC234"
          className="mt-2 w-full rounded-xl border border-line bg-transparent px-4 py-2.5 uppercase tracking-widest"
        />
        <Button className="mt-3 w-full" variant="secondary" disabled={busy} onClick={handleJoin}>
          Join room
        </Button>
      </Card>

      {error && <p role="alert" className="mt-4 text-center text-sm text-danger">{error}</p>}

      <p className="mt-6 text-center text-sm text-muted">
        Online rooms now support the core reveal, clue, discussion, and voting flow.
      </p>
    </div>
  );
}
