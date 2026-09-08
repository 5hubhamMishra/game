import type { Metadata } from "next";
import { JoinForm } from "@/features/online/JoinForm";

export const metadata: Metadata = { title: "Play Online" };

export default function OnlinePage() {
  return <JoinForm />;
}
