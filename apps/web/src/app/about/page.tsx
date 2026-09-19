import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">About Between Words</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Between Words is a browser-based party game of related secret words and social deduction.
        Almost every player is quietly given the same secret word. A smaller group is given a
        different word that is closely related — near enough that their clues can pass for genuine,
        far enough that a careful listener can catch the difference.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">How it differs from role-reveal games</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Nobody is told which group they are in. Instead of knowing you are the odd one out and
        having to bluff convincingly, you only know your own word — you have to work out for
        yourself, from everyone else&apos;s clues, whether you are the one who doesn&apos;t quite
        fit. Either word in a given pair can end up being the majority&apos;s or the minority&apos;s;
        the game reshuffles that every round.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">A round</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Everyone gives a short clue about their word in turn, without saying the word itself or
        anything that would trivially give it away. The table discusses, then votes out whoever
        seems most likely to be holding the other word. Play continues over several rounds — one
        elimination at most per round, never more — until the minority is caught, survives to the
        round limit, or reaches numeric parity with the majority.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Modes</h2>
      <p className="mt-2 leading-relaxed text-muted">
        <strong>Pass &amp; Play</strong> runs entirely on one shared device passed around the table,
        with each player&apos;s word revealed privately in turn. <strong>Play Online</strong> puts
        everyone in a private room from their own browser — no app install, no account.
      </p>
    </div>
  );
}
