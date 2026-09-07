import type { Metadata } from "next";
import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";

export const metadata: Metadata = { title: "Play Online" };

export default function OnlinePage() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">Play Online</h1>
      <Card className="mt-6 text-left">
        <p className="leading-relaxed text-muted">
          Online rooms need a persistent game server and database that this build does not yet
          have configured, so private rooms are not available here. Building that piece honestly
          takes real backend work — it is not something to fake with a client-only room.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          Everything on this device works today: start a Pass &amp; Play game and hand the device
          around the table.
        </p>
      </Card>
      <LinkButton href="/local" className="mt-6">
        Start Pass &amp; Play instead
      </LinkButton>
    </div>
  );
}
