"use client";

import { useRouter } from "next/navigation";
import { isMinority, wordFor, type WinReasonCode } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useLocalGame } from "../LocalGameContext";

const REASON_TEXT: Record<WinReasonCode, string> = {
  ALL_MINORITY_ELIMINATED: "every minority player was eliminated.",
  MINORITY_REACHED_PARITY: "the minority reached parity with the surviving majority.",
  MINORITY_SURVIVED_CYCLE_LIMIT: "the minority survived all five deduction cycles.",
};

export function ResultsScreen() {
  const router = useRouter();
  const { game, nameOf, scores, rematch, backToLobby } = useLocalGame();
  if (!game || !game.winner || !game.winReason) return null;

  const sortedPlayers = [...game.players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-teal">
          {game.winner === "minority" ? "Minority wins" : "Majority wins"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">Results</h1>
        <p className="mt-2 text-muted">{REASON_TEXT[game.winReason]}</p>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-center gap-5 font-display text-2xl font-semibold">
          <span className={game.winner === "majority" ? "text-teal" : ""}>{game.majorityWord}</span>
          <span aria-hidden="true" className="text-amber">
            ↔
          </span>
          <span className={game.winner === "minority" ? "text-teal" : ""}>{game.minorityWord}</span>
        </div>
        <ul className="mt-5 grid gap-1.5 text-sm">
          {game.players.map((id) => (
            <li key={id} className="flex justify-between border-b border-line py-1.5 last:border-0">
              <span className="font-semibold">
                {nameOf(id)}
                {game.eliminated.includes(id) ? " (out)" : ""}
              </span>
              <span className="text-muted">
                {wordFor(game, id)} · {isMinority(game, id) ? "minority" : "majority"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-lg font-semibold">Scores</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {sortedPlayers.map((id) => (
            <li key={id} className="flex justify-between py-1">
              <span>{nameOf(id)}</span>
              <span className="font-semibold">{scores[id] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button className="flex-1" onClick={rematch}>
          Play again
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            backToLobby();
            router.push("/local");
          }}
        >
          Back to lobby
        </Button>
      </div>
    </div>
  );
}
