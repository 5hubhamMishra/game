import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-2xl py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">Social deduction, quietly</p>
        <h1 className="mt-4 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
          Between <span className="text-teal">Words</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted">
          Almost everyone gets the same word. A quiet few get something close, but not quite it.
          Describe your word without saying it — and work out who is holding the other one.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/local">Pass &amp; Play</LinkButton>
          <LinkButton href="/online" variant="secondary">
            Play Online
          </LinkButton>
        </div>
      </section>

      <Card className="mx-auto max-w-lg">
        <header className="flex justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span>Example pair</span>
          <span>Drinks</span>
        </header>
        <div className="flex items-center justify-center gap-5 py-6 font-display text-3xl font-semibold sm:text-4xl">
          <span>Cappuccino</span>
          <span aria-hidden="true" className="text-2xl text-amber">
            ↔
          </span>
          <span>Latte</span>
        </div>
        <p className="text-center text-sm text-muted">
          Most players hold one word. A minority quietly holds the other — related, but different
          enough to catch out an unconvincing clue.
        </p>
      </Card>

      <section className="mx-auto mt-16 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="font-display text-xl font-semibold">One shared device</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pass & Play reveals each word privately as the device goes around the table, then
            times spoken clues, discussion, and a private vote.
          </p>
        </Card>
        <Card>
          <h3 className="font-display text-xl font-semibold">Your own browser</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Play Online puts everyone in a private room from their own device — text clues,
            in-game discussion, and a private vote, no app install required.
          </p>
        </Card>
      </section>
    </div>
  );
}
