"use client";

import { wordFor } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Countdown } from "../Countdown";
import { HandoffShield } from "../HandoffShield";
import { useLocalGame } from "../LocalGameContext";
import { useShieldStage } from "../useShieldStage";

export function PrivateRevealScreen() {
  const { game, nameOf, acknowledge } = useLocalGame();
  const currentId = game ? game.players.find((id) => !game.acknowledged.includes(id)) ?? null : null;
  const [stage, setStage] = useShieldStage(currentId);
  if (!game || !currentId) return null;

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Revealing words — {game.acknowledged.length} of {game.players.length}
        </p>
        <Countdown deadline={game.deadline} />
      </div>

      {stage === "shield" ? (
        <div className="mt-4">
          <HandoffShield
            name={nameOf(currentId)}
            actionLabel="Reveal my word"
            onReveal={() => setStage("content")}
          />
        </div>
      ) : (
        <Card className="mt-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Your word</p>
          <p className="mt-4 font-display text-4xl font-bold text-teal">{wordFor(game, currentId)}</p>
          <p className="mt-4 text-sm text-muted">Describe your word without saying it.</p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              acknowledge(currentId);
              setStage("shield");
            }}
          >
            Hide and pass
          </Button>
        </Card>
      )}
    </div>
  );
}
