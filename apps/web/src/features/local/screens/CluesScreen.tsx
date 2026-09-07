"use client";

import { currentSpeaker, cycleOrder } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Countdown } from "../Countdown";
import { useLocalGame } from "../LocalGameContext";

export function CluesScreen() {
  const { game, nameOf, giveClueAloud } = useLocalGame();
  if (!game) return null;
  const speaker = currentSpeaker(game);
  const order = cycleOrder(game);
  const turnNumber = order.findIndex((id) => id === speaker) + 1;

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Cycle {game.cycle} · Turn {turnNumber} of {order.length}
        </p>
        <Countdown deadline={game.deadline} />
      </div>

      {speaker && (
        <Card className="mt-4 text-center">
          <p className="text-sm text-muted">It is</p>
          <h2 className="mt-1 font-display text-3xl font-bold">{nameOf(speaker)}&apos;s turn</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Say a short spoken clue about your word — one to three words, without saying the word
            itself.
          </p>
          <Button className="mt-5 w-full" onClick={() => giveClueAloud(speaker)}>
            Done — next player
          </Button>
        </Card>
      )}

      {game.clues.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Clues so far</h3>
          <ul className="mt-2 grid gap-1">
            {game.clues.map((clue, i) => (
              <li
                key={i}
                className="flex justify-between border-b border-line py-2 text-sm last:border-0"
              >
                <span className="font-semibold">{nameOf(clue.playerId)}</span>
                <span className="text-muted">
                  {clue.text ?? "No clue submitted"}
                  {game.cycle > 1 ? ` · cycle ${clue.cycle}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
