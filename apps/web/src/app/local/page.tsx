import type { Metadata } from "next";
import { SetupForm } from "@/features/local/SetupForm";

export const metadata: Metadata = { title: "Pass & Play" };

export default function LocalSetupPage() {
  return <SetupForm />;
}
