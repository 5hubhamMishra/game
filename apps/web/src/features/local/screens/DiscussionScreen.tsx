"use client";

import { useState } from "react";
import { activePlayers } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Countdown } from "../Countdown";
import { useLocalGame } from "../LocalGameContext";

export function DiscussionScreen() {
  const { game, nameOf, endDiscussionNow, requestEarlyVoteFrom, acceptEarlyVoteFrom } = useLocalGame();
  const [showRequest, setShowRequest] = useState(false);
  if (!game) return null;

  const active = activePlayers(game);
  const cycleClues = game.clues.filter((c) => c.cycle === game.cycle);

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Discussion — cycle {game.cycle}</p>
        <Countdown deadline={game.deadline} />
      </div>

      <Card className="mt-4">
        <p className="text-sm leading-relaxed text-muted">
          Talk it over out loud. Anyone who seems unsure of their word, or gave a strange clue, is
          worth questioning.
        </p>
        {cycleClues.length > 0 && (
          <ul className="mt-4 grid gap-1 text-sm">
            {cycleClues.map((clue, i) => (
              <li key={i} className="flex justify-between border-b border-line py-1.5 last:border-0">
                <span className="font-semibold">{nameOf(clue.playerId)}</span>
                <span className="text-muted">{clue.text ?? "No clue submitted"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Button className="mt-4 w-full" onClick={endDiscussionNow}>
        Start voting
      </Button>

      <div className="mt-4">
        {game.earlyVoteRequestedBy === null ? (
          !showRequest ? (
            <button
              type="button"
              className="text-sm font-semibold text-muted underline hover:text-teal"
              onClick={() => setShowRequest(true)}
            >
              Vote early instead?
            </button>
          ) : (
            <Card>
              <p className="text-sm font-semibold">Who wants to request an early vote?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.map((id) => (
                  <Button key={id} variant="secondary" onClick={() => requestEarlyVoteFrom(id)}>
                    {nameOf(id)}
                  </Button>
                ))}
              </div>
            </Card>
          )
        ) : (
          <Card>
            <p className="text-sm">
              <strong>{nameOf(game.earlyVoteRequestedBy)}</strong> wants to vote now —{" "}
              {game.earlyVoteAccepts.length} of {active.length} agree (a majority is needed).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {active
                .filter((id) => !game.earlyVoteAccepts.includes(id))
                .map((id) => (
                  <Button key={id} variant="secondary" onClick={() => acceptEarlyVoteFrom(id)}>
                    {nameOf(id)} agrees
                  </Button>
                ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
