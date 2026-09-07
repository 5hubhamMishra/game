"use client";

import { useState } from "react";
import { activePlayers, voteTargets } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Countdown } from "../Countdown";
import { HandoffShield } from "../HandoffShield";
import { useLocalGame } from "../LocalGameContext";
import { useShieldStage } from "../useShieldStage";

const ABSTAIN = "__abstain__";

export function VotingScreen() {
  const { game, nameOf, vote } = useLocalGame();
  const active = game ? activePlayers(game) : [];
  const currentId = game ? active.find((id) => !game.ballots.some((b) => b.voterId === id)) ?? null : null;
  const [stage, setStage] = useShieldStage(currentId);
  const [selected, setSelected] = useState<string | null>(null);

  if (!game || !currentId) return null;
  const targets = voteTargets(game, currentId);

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {game.votingRound === "runoff" ? "Runoff vote" : "Voting"} — {game.ballots.length} of{" "}
          {active.length} voted
        </p>
        <Countdown deadline={game.deadline} />
      </div>

      {stage === "shield" ? (
        <div className="mt-4">
          <HandoffShield
            name={nameOf(currentId)}
            actionLabel="Vote privately"
            onReveal={() => setStage("content")}
          />
        </div>
      ) : (
        <Card className="mt-4">
          <p className="text-center text-sm text-muted">Who do you think holds the other word?</p>
          <div className="mt-4 grid gap-2">
            {targets.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`min-h-[44px] rounded-lg border px-4 py-2 text-left font-medium ${
                  selected === id ? "border-teal bg-teal/10 text-teal" : "border-line bg-white"
                }`}
              >
                {nameOf(id)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected(ABSTAIN)}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-left font-medium ${
                selected === ABSTAIN ? "border-teal bg-teal/10 text-teal" : "border-line bg-white"
              }`}
            >
              Abstain
            </button>
          </div>
          <Button
            className="mt-5 w-full"
            disabled={selected === null}
            onClick={() => {
              vote(currentId, selected === ABSTAIN ? null : selected);
              setSelected(null);
              setStage("shield");
            }}
          >
            Confirm vote
          </Button>
        </Card>
      )}
    </div>
  );
}
