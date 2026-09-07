"use client";

import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { useLocalGame } from "./LocalGameContext";
import { PrivateRevealScreen } from "./screens/PrivateRevealScreen";
import { CluesScreen } from "./screens/CluesScreen";
import { DiscussionScreen } from "./screens/DiscussionScreen";
import { VotingScreen } from "./screens/VotingScreen";
import { ResolutionScreen } from "./screens/ResolutionScreen";
import { ResultsScreen } from "./screens/ResultsScreen";

export function PlayFlow() {
  const router = useRouter();
  const { game, error, clearError, backToLobby } = useLocalGame();

  if (!game) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Card>
          <h1 className="font-display text-2xl font-semibold">No game in progress</h1>
          <p className="mt-2 text-sm text-muted">
            An active local game is never saved across a refresh, on purpose — start a fresh one
            from setup.
          </p>
          <LinkButton href="/local" className="mt-5 w-full">
            Back to setup
          </LinkButton>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mx-auto mt-4 flex max-w-md items-center justify-between gap-3 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss" className="font-bold">
            ✕
          </button>
        </div>
      )}

      {game.phase === "PRIVATE_REVEAL" && <PrivateRevealScreen />}
      {game.phase === "CLUES" && <CluesScreen />}
      {game.phase === "DISCUSSION" && <DiscussionScreen />}
      {game.phase === "VOTING" && <VotingScreen />}
      {game.phase === "RESOLUTION" && <ResolutionScreen />}
      {game.phase === "RESULTS" && <ResultsScreen />}
      {game.phase === "ABORTED" && (
        <div className="mx-auto max-w-md py-16 text-center">
          <Card>
            <h1 className="font-display text-2xl font-semibold">Game aborted</h1>
            <p className="mt-2 text-sm text-muted">
              Not everyone acknowledged their word in time, so this game ended without a winner
              and without points.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                backToLobby();
                router.push("/local");
              }}
            >
              Back to lobby
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
