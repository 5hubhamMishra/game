import type { Metadata } from "next";
import { Card } from "@/components/Card";

export const metadata: Metadata = { title: "How to play" };

const STEPS = [
  {
    title: "Everyone gets a word",
    body: "Most players receive the same word. One or more players quietly receive a related but different word. Nobody is told who is who.",
  },
  {
    title: "Describe it without naming it",
    body: "Taking turns, each player gives a one-to-three word clue about their word. Say too little and nobody trusts you; say too much and you might give it away.",
  },
  {
    title: "Discuss, then vote",
    body: "Talk over who seemed off. Then everyone privately votes to eliminate one player, or abstains. Ties trigger a single runoff.",
  },
  {
    title: "Repeat, or finish",
    body: "The game continues in cycles. It ends when the minority is fully eliminated, reaches parity with the majority, or survives five cycles.",
  },
];

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">How to play</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Between Words is built around one paired secret: a majority word and a related minority
        word. Example: most players hold <strong>cappuccino</strong>, a quiet few hold{" "}
        <strong>latte</strong>. Either side can end up as the minority — it is randomized every
        game.
      </p>

      <div className="mt-8 grid gap-4">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="flex gap-4">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-amber font-display font-bold text-ink"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Ties and parity</h2>
      <p className="mt-2 leading-relaxed text-muted">
        A vote eliminates whoever has the single highest count — a majority is not required. If
        the top count is tied, everyone votes again among just the tied players. A second tie, or
        a runoff with no votes cast, eliminates nobody. The minority wins as soon as it is at
        least as large as the surviving majority, the majority wins if the minority is wiped out,
        and the minority also wins by surviving five full cycles.
      </p>

      <h2 className="mt-10 font-display text-2xl font-semibold">Pass & Play vs. Online</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Pass & Play shares one device: words are revealed privately as it goes around the table,
        clues are spoken aloud, and votes are entered by passing the device with the screen
        shielded. It relies on players being honest about not peeking — there is no technical
        protection against someone using developer tools or looking at another player&apos;s
        screen. Online rooms give each player their own browser, so word assignments are enforced
        by the server and never sent to anyone but the player who holds them.
      </p>
    </div>
  );
}
