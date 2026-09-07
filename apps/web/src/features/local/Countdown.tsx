"use client";

import { useEffect, useState } from "react";

export function Countdown({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span
      className="text-xs font-bold uppercase tracking-wide text-muted"
      role="timer"
      aria-live="off"
    >
      {secondsLeft}s left
    </span>
  );
}
