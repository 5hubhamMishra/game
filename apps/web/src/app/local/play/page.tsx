import type { Metadata } from "next";
import { PlayFlow } from "@/features/local/PlayFlow";

export const metadata: Metadata = { title: "Playing — Pass & Play" };

export default function LocalPlayPage() {
  return <PlayFlow />;
}
