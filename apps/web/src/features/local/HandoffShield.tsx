import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function HandoffShield({
  name,
  actionLabel,
  onReveal,
}: {
  name: string;
  actionLabel: string;
  onReveal: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Pass the device to</p>
      <h2 className="mt-2 font-display text-3xl font-bold">{name}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Make sure nobody else can see the screen before continuing.
      </p>
      <Button className="mt-5 w-full" onClick={onReveal}>
        {actionLabel}
      </Button>
    </Card>
  );
}
