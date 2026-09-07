"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useLocalGame } from "../LocalGameContext";

export function ResolutionScreen() {
  const { game, nameOf, continueFromResolution } = useLocalGame();
  if (!game) return null;

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <Card>
        {game.lastEliminated ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Eliminated</p>
            <h2 className="mt-2 font-display text-3xl font-bold">{nameOf(game.lastEliminated)}</h2>
            <p className="mt-3 text-sm text-muted">
              Marked out. No word or allegiance is revealed — theirs or anyone else&apos;s.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-3xl font-bold">Nobody was eliminated</h2>
            <p className="mt-3 text-sm text-muted">The vote didn&apos;t produce a result this round.</p>
          </>
        )}
      </Card>
      <Button className="mt-6 w-full" onClick={continueFromResolution}>
        {game.winner ? "See results" : "Continue"}
      </Button>
    </div>
  );
}
