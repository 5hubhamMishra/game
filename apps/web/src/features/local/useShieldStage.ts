import { useEffect, useRef, useState } from "react";

export type ShieldStage = "shield" | "content";

/**
 * Tracks the pass-the-device shield for whichever player id is "current".
 * Resets to the shield whenever the current id changes, so the next player's
 * private content is never shown until they explicitly reveal it.
 */
export function useShieldStage(currentId: string | null) {
  const [stage, setStage] = useState<ShieldStage>("shield");
  const prev = useRef(currentId);

  useEffect(() => {
    if (prev.current !== currentId) {
      prev.current = currentId;
      setStage("shield");
    }
  }, [currentId]);

  // Private content must not stay visible if the device is backgrounded or
  // the tab loses focus — someone else may be looking at the screen.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") setStage("shield");
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return [stage, setStage] as const;
}
