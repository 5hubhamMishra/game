import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Between Words has no accounts, no payments, and no ads. Here is exactly what is stored and
        for how long.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Pass &amp; Play</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Everything happens on your device. Player names, chosen categories, and scores are kept in
        this browser&apos;s local storage only, and are never sent anywhere. An active game&apos;s
        word assignments live only in memory and are discarded on refresh — this is intentional,
        not a bug. Local play offers no protection against another person at the table using
        browser developer tools or looking over someone&apos;s shoulder.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Online rooms</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Joining an online room creates a guest session identified by an opaque, high-entropy
        cookie — no email, phone number, or account is required. A room stores a display name,
        connection status, the game in progress, and votes. Word assignments and private ballots
        are never sent to any client except the player they belong to, and are only revealed to
        everyone once a game reaches its results.
      </p>
      <p className="mt-2 leading-relaxed text-muted">
        A room with nobody connected is deleted after ten minutes. An idle lobby expires after two
        hours. All room and game data — including chat, clues, and votes — is deleted within 24
        hours of a room reaching a terminal state. Room codes and in-game words are excluded from
        search indexing.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">What we do not do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-muted">
        <li>No accounts, no tracking cookies, no third-party analytics in gameplay.</li>
        <li>No public room directory — rooms are only reachable by their invite code or link.</li>
        <li>No AI-generated clues and no runtime AI dependency of any kind.</li>
      </ul>
    </div>
  );
}
